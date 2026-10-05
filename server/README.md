# Tasker Summary Service

Small service that keeps secrets off users' machines. The extension sends
aggregate totals and this service adds the Gemini key; the extension asks to
buy Pro and this service creates the Bachs checkout and confirms it was paid.

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
| `BACHS_API_KEY` | for payments | — | `sk_sandbox_...` or `sk_live_...` (see below) |
| `BACHS_PRODUCT_IDS` | for payments | — | `prod_...` of the Pro product; comma-separate to accept several |
| `BACHS_SUCCESS_URL` | no | `.../thanks.html` | Where the buyer lands after paying |
| `BACHS_CANCEL_URL` | no | `.../#pro` | Where the buyer lands if they back out |
| `ALLOWED_WEB_ORIGINS` | no | `https://emperorda8.github.io` | Sites allowed to start a checkout or finish a password reset (landing page only) |
| `POWABASE_URL` | for accounts | — | `https://<ref>.p.powabase.ai` |
| `POWABASE_ANON_KEY` | for accounts | — | Publishable key. Held here so it can be rotated without a store release |
| `POWABASE_SERVICE_KEY` | for accounts | — | **Secret** service-role key. Only writer to `public.licenses` |
| `RESET_PASSWORD_URL` | no | `.../reset.html` | Where password-recovery emails link to |

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

## Accounts and licences (Powabase)

Free use needs no account. Pro does, so a purchase belongs to a person and follows
them to a new computer instead of being a string that can be shared.

The extension never talks to Powabase. It talks to this service, which holds the
keys. That keeps them out of readable extension source, and matters in practice:
the anon key Powabase issues **carries an expiry date**, so one baked into a
published extension would stop working on that date and could only be fixed with
a Web Store release. Here it is an environment variable.

| Endpoint | Auth | Does |
|---|---|---|
| `POST /v1/auth/signup` `signin` `refresh` `signout` | none / refresh token | Thin, validated wrappers over GoTrue; return a normalised session |
| `POST /v1/auth/recover` | none | Sends a reset email. Always 200, so it cannot reveal who has an account |
| `POST /v1/auth/reset-password` | recovery token | Called by `reset.html` on the landing site |
| `POST /v1/checkout/create` | extension: session required | Opens a Bachs checkout reserved for that account |
| `POST /v1/license/verify` | session | Reads the checkout from Bachs, then claims it for the account |
| `POST /v1/license/status` | session | What does this account own? Re-asks Bachs if the last check is over 12h old |

**Ownership.** `public.licenses` (see `db/001_licenses.sql`) has a unique
`checkout_id`, so a paid checkout unlocks exactly one account. A checkout opened
while signed in carries the account's id and can be claimed only by it; one bought
on the website is claimed by the first signed-in user who pastes its reference.

**Security model.** Row Level Security is on and `anon` has no access at all.
Signed-in users may `select` their own rows and nothing else; only this service
(service-role key, which bypasses RLS) can write. A leaked anon key or a user's
own token can therefore never grant or edit a licence. This was verified by
impersonating each role in a rolled-back transaction.

**Failing open.** If Bachs or Powabase is unreachable, a stored licence stays
valid. Pro is removed only on a definite full refund.

### Set up

1. Run `db/001_licenses.sql` against the project (the Powabase MCP's
   `execute_sql`, or `psql` with the Database URL).
2. From the project's Connect modal set `POWABASE_URL`, `POWABASE_ANON_KEY` and
   `POWABASE_SERVICE_KEY` in your host's dashboard. **Never commit the service key.**
3. Add `RESET_PASSWORD_URL` to the project's `URI_ALLOW_LIST` (already done for
   the default).
4. **Configure SMTP** on the project. Until you do, password-recovery emails are
   not delivered.
5. Decide on email confirmation. The project ships with `MAILER_AUTOCONFIRM: true`,
   so anyone can register any address without proving they own it. That is
   tolerable while accounts only gate a purchase you have already made, but turn
   confirmation on once SMTP works if you want addresses verified.

## Payments (Bachs)

Pro is a one-time purchase sold through [Bachs](https://docs.bachs.io). The
service has two endpoints for it, and neither touches card data - the buyer pays
on Bachs' hosted page.

| Endpoint | Caller | Does |
|---|---|---|
| `POST /v1/checkout/create` | extension (signed in), landing page | Creates a hosted checkout for the Pro product, returns `checkoutUrl` and `checkoutId` |
| `POST /v1/license/verify` | extension (signed in) | Reads the checkout back from Bachs, answers `valid` or a reason, and claims it for the account |

`verify` answers `valid: true` only when the checkout is `completed`, its payment
succeeded, it contains one of `BACHS_PRODUCT_IDS`, and the charge has not been
refunded. Otherwise `reason` is one of `pending`, `not_paid`, `not_found`,
`wrong_product`, `refunded`, `other_account`, `already_claimed`. The extension re-asks
about once a day and removes Pro only on a definite refund; an outage never locks
anyone out.

### Set up

1. In the Bachs dashboard (start in **sandbox**), create a **one-time, fixed-price
   product** and copy its `prod_...` ID into `BACHS_PRODUCT_IDS`.
2. Create an API key with the `payments:write` and `payments:read` scopes and set
   it as `BACHS_API_KEY`. **Set it in your host's dashboard; never commit it.**
3. Pay with a sandbox checkout end to end and confirm Pro unlocks.
4. To go live: swap in an `sk_live_...` key and the live product ID. The key
   prefix alone picks the Bachs host, so a sandbox key cannot reach production.

### Why it reads the checkout instead of using a webhook

Bachs recommends webhooks as the source of truth for fulfilment, and the thing it
warns against is trusting a browser redirect. This service never does: unlocking
rests on an authenticated server-to-server read of the checkout, which is Bachs'
own record of the payment. That is also what keeps this service database-free.

A webhook (`collection.succeeded`, signed with `X-Bachs-Signature-V2`) becomes
worthwhile if you add a durable store - for example to email a licence, keep a
list of buyers, or revoke on a chargeback the moment it happens rather than at
the next daily check. Until then it would have nowhere to write to.

### Refunds

Refund from the Bachs dashboard. A **full** refund revokes Pro at the next daily
check on the buyer's machine. A **partial** refund does not.

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
