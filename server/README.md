# Tasker Summary Service

Small proxy that keeps the Gemini API key off users' machines. The extension
sends aggregate totals, this service adds the key and calls Gemini.

**Never put the key in the extension.** A published Chrome extension is readable
source: anyone can unzip it and take the key. That is the entire reason this
service exists.

## What the extension sends

```json
{
  "installId": "random-uuid-generated-on-device",
  "monthKey": "2026-08",
  "totalSeconds": 421200,
  "daysTracked": 21,
  "categories": { "Development": 210600, "Research": 108000 }
}
```

No URLs, page titles, domains, notes or milestones. Browsing history cannot be
reconstructed from this payload.

## Deploy

Any Node 18+ host. No dependencies, no build step.

**Render** (free tier works): New Web Service, point at this repo, root directory
`server`, build command empty, start command `npm start`.

Then set environment variables in the host's dashboard — **set the key yourself
there, never commit it**:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | yes | — | From Google AI Studio |
| `ALLOWED_EXTENSION_IDS` | **yes** | (any extension) | `nfdjclnanladapnhofbmnhclkhlndeak` |
| `MAX_PER_INSTALL_MONTH` | no | `3` | AI summaries per install per month |
| `MAX_GLOBAL_PER_DAY` | no | `300` | Fleet-wide daily ceiling |
| `MIN_SECONDS_BETWEEN` | no | `20` | Per-install cooldown |
| `GEMINI_MODEL` | no | `gemini-1.5-flash` | Cheapest capable model |

Check it is up: `GET /health` returns `{"ok":true}`.

### Set `ALLOWED_EXTENSION_IDS` before you publish

With it unset, `originAllowed` accepts **any** `chrome-extension://` origin — anyone
who finds the URL can point their own extension at it and spend your Gemini quota.
The Web Store item ID for Tasker is:

```
nfdjclnanladapnhofbmnhclkhlndeak
```

Set it, redeploy, and confirm with a request from an unknown origin returning
`403 forbidden_origin`.

## Then point the extension at it

1. `background/summarizer.js` — set `SUMMARY_SERVICE_URL` to
   `https://<your-service>/v1/monthly-summary`
2. `manifest.json` — set `host_permissions` to `https://<your-service>/*`
3. Rebuild the zip.

## Cost control

Three application limits are enforced here: per install per month, per IP per
day, and a global daily ceiling. They exist for fairness between users.

**They are not the cost guarantee.** Counters are in memory, so they reset when
the process restarts and are per-instance if you ever run more than one. The
`installId` is generated on the client and could be forged by someone determined.

The only limit that cannot be bypassed is a **hard quota on the API key in Google
Cloud Console** (APIs & Services → Generative Language API → Quotas). Set one
before you publish. Treat it as the real ceiling and everything here as
best-effort fairness on top.

If usage grows enough to matter, move the counters into a shared store (Redis,
Postgres) so they survive restarts and work across instances.

## Failure behaviour

If this service is down, rate-limited, or misconfigured, the extension silently
falls back to its offline rule-based summary. Users still get a monthly recap;
it just is not AI-written. Nothing breaks.
