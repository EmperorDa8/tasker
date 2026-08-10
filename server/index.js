/**
 * Tasker Summary Service
 *
 * Sits between the extension and the Gemini API so the API key stays server-side.
 * A Chrome extension ships as readable source, so a key embedded in it is public
 * the moment the extension is published.
 *
 * Deliberately zero-dependency: runs on Node 18+ anywhere (Render, Railway, Fly,
 * a VPS) with no install step.
 *
 * Required env:
 *   GEMINI_API_KEY        your Google Gemini API key
 * Optional env:
 *   PORT                  default 3000
 *   ALLOWED_EXTENSION_IDS comma-separated Chrome extension IDs allowed to call
 *   MAX_PER_INSTALL_MONTH default 3
 *   MAX_GLOBAL_PER_DAY    default 300
 *   MIN_SECONDS_BETWEEN   default 20
 *   GEMINI_MODEL          default gemini-1.5-flash
 */

const http = require('http');

const PORT = parseInt(process.env.PORT || '3000', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const ALLOWED_EXTENSION_IDS = (process.env.ALLOWED_EXTENSION_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const MAX_PER_INSTALL_MONTH = parseInt(process.env.MAX_PER_INSTALL_MONTH || '3', 10);
const MAX_GLOBAL_PER_DAY = parseInt(process.env.MAX_GLOBAL_PER_DAY || '300', 10);
const MIN_SECONDS_BETWEEN = parseInt(process.env.MIN_SECONDS_BETWEEN || '20', 10);
const MAX_BODY_BYTES = 8 * 1024;
const MAX_OUTPUT_TOKENS = 700;

// ---------------------------------------------------------------- rate limiting
// In-memory: resets if the process restarts, and is per-instance. It exists for
// fairness between users, NOT as the cost guarantee - set a hard quota on the key
// in Google Cloud Console, which is the only limit that cannot be bypassed.
const installUsage = new Map();  // installId -> { monthKey, count, lastRequestMs }
const ipUsage = new Map();       // ip -> { dayKey, count }
let globalUsage = { dayKey: '', count: 0 };

function todayKey() { return new Date().toISOString().slice(0, 10); }
function thisMonthKey() { return new Date().toISOString().slice(0, 7); }

// Keep the maps from growing without bound on a long-lived process.
setInterval(() => {
  const month = thisMonthKey();
  const day = todayKey();
  for (const [k, v] of installUsage) if (v.monthKey !== month) installUsage.delete(k);
  for (const [k, v] of ipUsage) if (v.dayKey !== day) ipUsage.delete(k);
}, 60 * 60 * 1000).unref();

function checkQuota(installId, ip) {
  const month = thisMonthKey();
  const day = todayKey();
  const now = Date.now();

  if (globalUsage.dayKey !== day) globalUsage = { dayKey: day, count: 0 };
  if (globalUsage.count >= MAX_GLOBAL_PER_DAY) {
    return { ok: false, status: 503, reason: 'daily_capacity_reached' };
  }

  const ipRecord = ipUsage.get(ip);
  const ipCount = ipRecord && ipRecord.dayKey === day ? ipRecord.count : 0;
  if (ipCount >= MAX_PER_INSTALL_MONTH * 4) {
    return { ok: false, status: 429, reason: 'too_many_requests' };
  }

  const record = installUsage.get(installId);
  if (record && record.monthKey === month) {
    if (now - record.lastRequestMs < MIN_SECONDS_BETWEEN * 1000) {
      return { ok: false, status: 429, reason: 'slow_down' };
    }
    if (record.count >= MAX_PER_INSTALL_MONTH) {
      return { ok: false, status: 429, reason: 'monthly_limit_reached' };
    }
  }
  return { ok: true };
}

function recordUsage(installId, ip) {
  const month = thisMonthKey();
  const day = todayKey();
  const record = installUsage.get(installId);
  if (record && record.monthKey === month) {
    record.count++;
    record.lastRequestMs = Date.now();
  } else {
    installUsage.set(installId, { monthKey: month, count: 1, lastRequestMs: Date.now() });
  }
  const ipRecord = ipUsage.get(ip);
  if (ipRecord && ipRecord.dayKey === day) ipRecord.count++;
  else ipUsage.set(ip, { dayKey: day, count: 1 });
  globalUsage.count++;
}

// ---------------------------------------------------------------- validation
function validPayload(body) {
  if (!body || typeof body !== 'object') return 'malformed body';
  if (typeof body.installId !== 'string' || body.installId.length < 8 || body.installId.length > 64) {
    return 'bad installId';
  }
  if (!/^\d{4}-\d{2}$/.test(body.monthKey || '')) return 'bad monthKey';
  if (typeof body.totalSeconds !== 'number' || body.totalSeconds < 0 || body.totalSeconds > 40000000) {
    return 'bad totalSeconds';
  }
  if (typeof body.daysTracked !== 'number' || body.daysTracked < 0 || body.daysTracked > 31) {
    return 'bad daysTracked';
  }
  if (!body.categories || typeof body.categories !== 'object') return 'bad categories';
  const keys = Object.keys(body.categories);
  if (keys.length > 20) return 'too many categories';
  for (const k of keys) {
    if (k.length > 40) return 'category name too long';
    if (typeof body.categories[k] !== 'number') return 'bad category value';
  }
  return null;
}

// ---------------------------------------------------------------- Gemini
function hours(seconds) { return Math.round((seconds / 3600) * 10) / 10; }

async function callGemini(payload) {
  const lines = Object.keys(payload.categories)
    .sort((a, b) => payload.categories[b] - payload.categories[a])
    .map(c => `- ${c}: ${hours(payload.categories[c])} hours`)
    .join('\n');

  const prompt = `You are a concise productivity coach writing a monthly work recap.

Month: ${payload.monthKey}
Total tracked time: ${hours(payload.totalSeconds)} hours across ${payload.daysTracked} active days.
Time by category:
${lines}

Return JSON with exactly two fields:
"summaryParagraph": 2-3 sentences summarising the month's focus in a warm, factual tone. Do not invent specific projects, companies or task names - you only know category totals.
"milestones": an array of 3-5 objects, each with "title", "description" and "category", describing themes visible in the category data. Keep each description under 15 words.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7
        }
      })
    }
  );

  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const data = await res.json();
  const raw = data && data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
  if (!raw) throw new Error('gemini_empty');

  const parsed = JSON.parse(raw);
  return {
    summaryParagraph: String(parsed.summaryParagraph || '').slice(0, 1200),
    milestones: Array.isArray(parsed.milestones)
      ? parsed.milestones.slice(0, 5).map(m => ({
          title: String(m.title || '').slice(0, 120),
          description: String(m.description || '').slice(0, 240),
          category: String(m.category || 'Productivity').slice(0, 40)
        }))
      : []
  };
}

// ---------------------------------------------------------------- http
function originAllowed(origin) {
  if (!origin || !origin.startsWith('chrome-extension://')) return false;
  if (ALLOWED_EXTENSION_IDS.length === 0) return true; // not yet pinned to an ID
  const id = origin.replace('chrome-extension://', '').replace(/\/$/, '');
  return ALLOWED_EXTENSION_IDS.includes(id);
}

function send(res, status, obj, origin) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (req.url === '/health') return send(res, 200, { ok: true }, null);

  if (req.method === 'OPTIONS') {
    if (!originAllowed(origin)) return send(res, 403, { error: 'forbidden_origin' }, null);
    return send(res, 204, {}, origin);
  }

  if (req.method !== 'POST' || req.url !== '/v1/monthly-summary') {
    return send(res, 404, { error: 'not_found' }, null);
  }
  if (!originAllowed(origin)) return send(res, 403, { error: 'forbidden_origin' }, null);
  if (!GEMINI_API_KEY) return send(res, 500, { error: 'server_not_configured' }, origin);

  let raw = '';
  let tooBig = false;

  // A client that drops mid-upload must not take the process down.
  req.on('error', () => { tooBig = true; });

  req.on('data', chunk => {
    if (tooBig) return;
    raw += chunk;
    if (raw.length > MAX_BODY_BYTES) {
      tooBig = true;
      // Answer first, then hang up - destroying the socket without a reply
      // leaves the caller staring at a connection reset instead of a 413.
      send(res, 413, { error: 'payload_too_large' }, origin);
      res.on('finish', () => { try { req.destroy(); } catch (e) { /* already gone */ } });
    }
  });

  req.on('end', async () => {
    if (tooBig) return;

    let body;
    try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'invalid_json' }, origin); }

    const invalid = validPayload(body);
    if (invalid) return send(res, 400, { error: 'invalid_payload', detail: invalid }, origin);

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket.remoteAddress || 'unknown';

    const quota = checkQuota(body.installId, ip);
    if (!quota.ok) return send(res, quota.status, { error: quota.reason }, origin);

    // Count the attempt before calling out, so a burst cannot slip past the cap
    // while requests are in flight.
    recordUsage(body.installId, ip);

    try {
      const result = await callGemini(body);
      return send(res, 200, result, origin);
    } catch (err) {
      console.warn('summary failed:', err && err.message);
      return send(res, 502, { error: 'summary_unavailable' }, origin);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tasker summary service listening on ${PORT}`);
  if (!GEMINI_API_KEY) console.warn('WARNING: GEMINI_API_KEY is not set - requests will fail.');
});
