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
 * Also sells and verifies Pro. Bachs is the system of record for who has paid,
 * so there is no database here: this creates the hosted checkout (the secret key
 * never leaves the server), and later reads that checkout back from Bachs to
 * decide whether it was really paid, for the Tasker product, and not refunded.
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
 * Payments (optional; without the first two, /v1/checkout/create and
 * /v1/license/verify return 501):
 *   BACHS_API_KEY         Bachs secret key. sk_sandbox_... talks to the sandbox,
 *                         sk_live_... to production - going live is a key swap.
 *                         Needs payments:write and payments:read.
 *   BACHS_PRODUCT_IDS     comma-separated product IDs (prod_...) that grant Pro
 *   BACHS_SUCCESS_URL     where Bachs sends the buyer after paying
 *   BACHS_CANCEL_URL      where Bachs sends the buyer if they back out
 *   ALLOWED_WEB_ORIGINS   comma-separated website origins allowed to start a
 *                         checkout or finish a password reset (the landing
 *                         page). Extensions are always allowed subject to
 *                         ALLOWED_EXTENSION_IDS.
 * Accounts (Powabase; without all three, accounts and licences return 501):
 *   POWABASE_URL          project API URL, https://<ref>.p.powabase.ai
 *   POWABASE_ANON_KEY     publishable key. Held here rather than in the
 *                         extension so it can be rotated without a store release.
 *   POWABASE_SERVICE_KEY  secret service-role key. Bypasses RLS; the only writer
 *                         to public.licenses. Never leaves this process.
 *   RESET_PASSWORD_URL    page password-recovery emails link to (reset.html)
 */

const http = require('http');
const crypto = require('crypto');
const { createAccounts } = require('./accounts');

const BACHS_API_KEY = process.env.BACHS_API_KEY || '';
// BACHS_API_BASE exists so the payment path can be pointed at a stub in tests.
// Leave it unset and the key prefix picks the host, so a sandbox key can never
// reach production by accident.
const BACHS_BASE = process.env.BACHS_API_BASE || (BACHS_API_KEY.startsWith('sk_live_')
  ? 'https://api.bachs.io'
  : 'https://sandbox-api.bachs.io');
const BACHS_PRODUCT_IDS = (process.env.BACHS_PRODUCT_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const BACHS_SUCCESS_URL = process.env.BACHS_SUCCESS_URL ||
  'https://emperorda8.github.io/tasker-extension/thanks.html';
const BACHS_CANCEL_URL = process.env.BACHS_CANCEL_URL ||
  'https://emperorda8.github.io/tasker-extension/#pro';
const ALLOWED_WEB_ORIGINS = (process.env.ALLOWED_WEB_ORIGINS || 'https://emperorda8.github.io')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const PAYMENTS_CONFIGURED = !!(BACHS_API_KEY && BACHS_PRODUCT_IDS.length);

const RESET_PASSWORD_URL = process.env.RESET_PASSWORD_URL ||
  'https://emperorda8.github.io/tasker-extension/reset.html';

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
  const hour = new Date().toISOString().slice(0, 13);
  for (const [k, v] of installUsage) if (v.monthKey !== month) installUsage.delete(k);
  for (const [k, v] of ipUsage) if (v.dayKey !== day) ipUsage.delete(k);
  for (const [k, v] of attempts) if (v.hour !== hour) attempts.delete(k);
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

// ---------------------------------------------------------------- payments

// Per-IP, per-hour caps, one bucket per route. A checkout ID is the only thing
// standing between a stranger and a free unlock, so guessing has to be
// expensive even though the keyspace is large. Verify is set high enough for
// the extension's background poll (every 30s for the hour a checkout lives).
const ATTEMPT_LIMITS = { verify: 150, create: 10, auth: 30 };
const attempts = new Map(); // `${bucket}:${ip}` -> { hour, count }

function allowAttempt(bucket, ip) {
  const hour = new Date().toISOString().slice(0, 13);
  const key = `${bucket}:${ip}`;
  const record = attempts.get(key);
  if (!record || record.hour !== hour) {
    attempts.set(key, { hour, count: 1 });
    return true;
  }
  if (record.count >= ATTEMPT_LIMITS[bucket]) return false;
  record.count++;
  return true;
}

/**
 * An error for a failed Bachs call. Bachs' error_code is a fixed vocabulary
 * (PRODUCT_NOT_FOUND, UNAUTHORIZED, ...), not user data, so it is safe to pass
 * along - it is what tells a misconfigured deploy apart from an outage.
 */
function bachsError(status, json) {
  const code = json && json.error_code;
  const err = new Error(`bachs_${status}_${code || 'unknown'}`);
  if (typeof code === 'string' && /^[A-Z][A-Z_]{2,60}$/.test(code)) err.bachsCode = code;
  return err;
}

async function bachs(method, path, body, idempotencyKey) {
  const headers = { 'Authorization': `Bearer ${BACHS_API_KEY}`, 'Accept': 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${BACHS_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  let json = null;
  try { json = await res.json(); } catch { /* an error page, not JSON */ }
  return { status: res.status, json };
}

/**
 * Open a hosted checkout for one Tasker Pro licence.
 *
 * The reference is derived from the install and a ten-minute window, and doubles
 * as the idempotency key. A double-click, or the options page and the dashboard
 * both asking at once, gets the same session back instead of two.
 */
async function createBachsCheckout(user, installId, source) {
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const digest = crypto.createHash('sha256').update(user ? user.id : installId).digest('hex').slice(0, 16);
  const reference = `tasker_pro_${digest}_${bucket.toString(36)}`;

  const { status, json } = await bachs('POST', '/v1/checkout-sessions', {
    product_cart: [{ product_id: BACHS_PRODUCT_IDS[0], quantity: 1 }],
    // Prefills the buyer's email on the hosted page. Anonymous web visitors omit
    // it and the page asks for one.
    ...(user && user.email ? { customer: { email: user.email } } : {}),
    success_url: BACHS_SUCCESS_URL,
    cancel_url: BACHS_CANCEL_URL,
    reference,
    // user_id reserves this checkout for the account that opened it, so the
    // order reference cannot be claimed by anyone else. install_id is a random
    // UUID, there only so a payment can be traced when a buyer writes in.
    metadata: { product: 'tasker_pro', install_id: installId, source, ...(user ? { user_id: user.id } : {}) },
    expires_in_minutes: 60
  }, reference);

  if ((status !== 200 && status !== 201) || !json || !json.checkout_id || !json.checkout_url) {
    throw bachsError(status, json);
  }
  return { checkoutId: json.checkout_id, checkoutUrl: json.checkout_url, expiresAt: json.expires_at || null };
}

// A charge in one of these states means the money arrived. A partial refund
// stays here on purpose: that is goodwill, not a cancelled sale.
const PAID_CHARGE_STATES = new Set(['succeeded', 'overpaid', 'partially_refunded']);
// These mean it was handed back in full, so the licence goes with it.
const REFUNDED_CHARGE_STATES = new Set(['refunded', 'auto_refunded']);

/**
 * Ask Bachs whether a checkout is a paid Tasker Pro purchase.
 *
 * Reading the session with the secret key is the same authority a webhook
 * carries - it is Bachs' own record, fetched server to server - and unlike the
 * browser redirect it cannot be forged or lost with a closed tab. It is also
 * what lets this service stay database-free, and it is why a refund revokes Pro:
 * the extension re-asks, and the charge is no longer in a paid state.
 *
 * A checkout ID is 16 random characters, so it is not guessable - but it is not
 * a secret the way a password is. That is an accepted trade for a one-time
 * product: the cost of someone sharing one is one extra unlock, and the
 * alternative is an account system for a tool whose pitch is that it has none.
 */
async function verifyBachsCheckout(checkoutId) {
  const { status, json } = await bachs('GET', `/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`);

  if (status === 404) return { valid: false, reason: 'not_found' };
  if (status !== 200 || !json) throw bachsError(status, json);

  // Without this, any paid checkout in the same Bachs account would unlock Pro.
  const products = Array.isArray(json.products) ? json.products : [];
  if (!products.some(p => p && BACHS_PRODUCT_IDS.includes(p.product_id))) {
    return { valid: false, reason: 'wrong_product' };
  }

  const chargeState = json.charge && json.charge.status;
  if (REFUNDED_CHARGE_STATES.has(chargeState)) return { valid: false, reason: 'refunded' };

  if (json.status === 'completed' && json.payment_status === 'succeeded' && PAID_CHARGE_STATES.has(chargeState)) {
    const owned = products.find(p => p && BACHS_PRODUCT_IDS.includes(p.product_id));
    return {
      valid: true,
      plan: 'lifetime',
      purchasedAt: json.completed_at || json.created_at || null,
      productId: owned.product_id,
      metadata: json.metadata || {}
    };
  }

  // Terminal and unpaid: nothing further is going to happen to this checkout.
  if (json.status === 'expired' || json.status === 'cancelled' ||
      json.payment_status === 'failed' || json.payment_status === 'canceled') {
    return { valid: false, reason: 'not_paid', status: json.status };
  }

  // Open, or paid but still settling (bank transfer, mobile money). Not an
  // answer yet - the caller keeps waiting rather than telling the buyer no.
  return { valid: false, reason: 'pending', status: json.status };
}

// ---------------------------------------------------------------- http
const accounts = createAccounts({
  url: process.env.POWABASE_URL,
  anonKey: process.env.POWABASE_ANON_KEY,
  serviceKey: process.env.POWABASE_SERVICE_KEY,
  verifyCheckout: verifyBachsCheckout
});

const AUTH_ROUTES = ['/v1/auth/signup', '/v1/auth/signin', '/v1/auth/refresh',
  '/v1/auth/recover', '/v1/auth/reset-password', '/v1/auth/signout'];
const LICENSE_ROUTES = ['/v1/license/verify', '/v1/license/status'];
const ROUTES = ['/v1/monthly-summary', '/v1/checkout/create', ...AUTH_ROUTES, ...LICENSE_ROUTES];

// The landing page may start a purchase and finish a password reset. Everything
// else stays extension-only, so a web origin never earns a wider door.
const WEB_ROUTES = ['/v1/checkout/create', '/v1/auth/reset-password'];

function originAllowed(origin, route) {
  if (!origin) return false;
  if (WEB_ROUTES.includes(route) && ALLOWED_WEB_ORIGINS.includes(origin)) return true;
  if (!origin.startsWith('chrome-extension://')) return false;
  if (ALLOWED_EXTENSION_IDS.length === 0) return true; // not yet pinned to an ID
  const id = origin.replace('chrome-extension://', '').replace(/\/$/, '');
  return ALLOWED_EXTENSION_IDS.includes(id);
}

function send(res, status, obj, origin) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(obj));
}

function validCredentials(body) {
  const email = String((body && body.email) || '').trim().toLowerCase();
  const password = String((body && body.password) || '');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'invalid_email', message: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'weak_password', message: 'Use at least 8 characters.' };
  // GoTrue hashes with bcrypt, which silently ignores everything past 72 bytes.
  if (Buffer.byteLength(password) > 72) return { error: 'weak_password', message: 'That password is too long (72 bytes at most).' };
  return { email, password };
}

function bearer(req) {
  const m = /^Bearer\s+(\S+)$/.exec(String(req.headers.authorization || ''));
  return m ? m[1] : null;
}

function sendAuthFailure(res, result, origin) {
  return send(res, result.status, { error: result.code, message: result.message }, origin);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (req.url === '/health') return send(res, 200, { ok: true }, null);

  const route = String(req.url || '').split('?')[0];

  if (req.method === 'OPTIONS') {
    if (!originAllowed(origin, route)) return send(res, 403, { error: 'forbidden_origin' }, null);
    return send(res, 204, {}, origin);
  }

  if (req.method !== 'POST' || ROUTES.indexOf(route) === -1) {
    return send(res, 404, { error: 'not_found' }, null);
  }
  if (!originAllowed(origin, route)) return send(res, 403, { error: 'forbidden_origin' }, null);
  if (route === '/v1/monthly-summary' && !GEMINI_API_KEY) {
    return send(res, 500, { error: 'server_not_configured' }, origin);
  }
  if ((AUTH_ROUTES.includes(route) || LICENSE_ROUTES.includes(route)) && !accounts.configured) {
    return send(res, 501, { error: 'accounts_not_configured' }, origin);
  }
  if ((route === '/v1/checkout/create' || LICENSE_ROUTES.includes(route)) && !PAYMENTS_CONFIGURED) {
    return send(res, 501, { error: 'payments_not_configured' }, origin);
  }

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

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket.remoteAddress || 'unknown';

    try {
      // ---- accounts
      if (AUTH_ROUTES.includes(route)) {
        if (!allowAttempt('auth', ip)) return send(res, 429, { error: 'too_many_attempts', message: 'Too many attempts. Try again in an hour.' }, origin);

        if (route === '/v1/auth/signup' || route === '/v1/auth/signin') {
          const c = validCredentials(body);
          if (c.error) return send(res, 400, { error: c.error, message: c.message }, origin);
          const result = route === '/v1/auth/signup'
            ? await accounts.signUp(c.email, c.password)
            : await accounts.signIn(c.email, c.password);
          return result.ok ? send(res, 200, result, origin) : sendAuthFailure(res, result, origin);
        }

        if (route === '/v1/auth/refresh') {
          const token = String((body && body.refreshToken) || '');
          if (!token || token.length > 512) return send(res, 400, { error: 'invalid_refresh_token' }, origin);
          const result = await accounts.refresh(token);
          return result.ok ? send(res, 200, result, origin) : sendAuthFailure(res, result, origin);
        }

        if (route === '/v1/auth/recover') {
          const email = String((body && body.email) || '').trim().toLowerCase();
          if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return send(res, 400, { error: 'invalid_email', message: 'Enter a valid email address.' }, origin);
          }
          return send(res, 200, await accounts.recover(email, RESET_PASSWORD_URL), origin);
        }

        if (route === '/v1/auth/reset-password') {
          const accessToken = String((body && body.accessToken) || '');
          const c = validCredentials({ email: 'x@x.xx', password: body && body.password });
          if (!accessToken || accessToken.length > 4096) return send(res, 400, { error: 'invalid_token' }, origin);
          if (c.error) return send(res, 400, { error: c.error, message: c.message }, origin);
          const result = await accounts.resetPassword(accessToken, c.password);
          return result.ok ? send(res, 200, { ok: true }, origin) : sendAuthFailure(res, result, origin);
        }

        // signout
        return send(res, 200, await accounts.signOut(bearer(req)), origin);
      }

      // ---- checkout
      if (route === '/v1/checkout/create') {
        const installId = String((body && body.installId) || '');
        if (installId.length < 8 || installId.length > 64) return send(res, 400, { error: 'bad_install_id' }, origin);

        // An extension must be signed in to buy: the licence belongs to the
        // account. A website visitor may buy first and claim it after signing up.
        const token = bearer(req);
        let user = null;
        if (token) {
          user = await accounts.userFor(token);
          if (!user) return send(res, 401, { error: 'invalid_session', message: 'Your session has expired. Sign in again.' }, origin);
        } else if (origin.startsWith('chrome-extension://')) {
          return send(res, 401, { error: 'signin_required', message: 'Sign in to upgrade.' }, origin);
        }

        if (!allowAttempt('create', ip)) return send(res, 429, { error: 'too_many_attempts' }, origin);
        const source = origin.startsWith('chrome-extension://') ? 'extension' : 'web';
        return send(res, 200, await createBachsCheckout(user, installId, source), origin);
      }

      // ---- licences
      if (LICENSE_ROUTES.includes(route)) {
        const user = await accounts.userFor(bearer(req));
        if (!user) return send(res, 401, { error: 'invalid_session', message: 'Your session has expired. Sign in again.' }, origin);
        // Rate limited by IP so the endpoint cannot be used to probe for valid
        // references, which are the only credential Pro has.
        if (!allowAttempt('verify', ip)) return send(res, 429, { error: 'too_many_attempts' }, origin);

        if (route === '/v1/license/status') return send(res, 200, await accounts.status(user), origin);

        const reference = String((body && body.reference) || '').trim();
        if (!/^chk_[a-z0-9]{8,64}$/i.test(reference)) return send(res, 400, { error: 'invalid_reference' }, origin);
        const installId = typeof (body && body.installId) === 'string' ? body.installId.slice(0, 64) : null;
        return send(res, 200, await accounts.claim(user, reference, installId), origin);
      }

      // ---- AI summary
      const invalid = validPayload(body);
      if (invalid) return send(res, 400, { error: 'invalid_payload', detail: invalid }, origin);

      const quota = checkQuota(body.installId, ip);
      if (!quota.ok) return send(res, quota.status, { error: quota.reason }, origin);

      // Count the attempt before calling out, so a burst cannot slip past the cap
      // while requests are in flight.
      recordUsage(body.installId, ip);

      try {
        return send(res, 200, await callGemini(body), origin);
      } catch (err) {
        console.warn('summary failed:', err && err.message);
        return send(res, 502, { error: 'summary_unavailable' }, origin);
      }
    } catch (err) {
      // Never echo err.message: it can carry upstream detail the caller has no
      // business seeing. The log has it.
      console.warn(`${route} failed:`, err && err.message);
      return send(res, 502, {
        error: 'service_unavailable',
        message: 'Something went wrong on our side. Try again shortly.',
        ...(err && err.bachsCode ? { detail: err.bachsCode } : {})
      }, origin);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tasker summary service listening on ${PORT}`);
  if (!GEMINI_API_KEY) console.warn('WARNING: GEMINI_API_KEY is not set - requests will fail.');
  if (!accounts.configured) console.warn('NOTE: POWABASE_* not set - accounts and licences are off.');
});
