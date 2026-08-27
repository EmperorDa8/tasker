# Tasker — Critical Feature Review & Prioritized Roadmap

**Date:** 2026-08-21 · **Reviewed version:** manifest `1.1.0` · **Scope:** product/feature research only, no source code changed.

Conventions used throughout:
- **[CODE]** — verified by reading the repository at `C:\Users\Dan\Documents\vibe-coding-project\tasker`.
- **[SOURCED]** — from external research, URL cited.
- **[INFERENCE]** — my judgement, not established fact. Treat as an opinion to argue with.

---

## 1. What Tasker actually does today (verified inventory)

### 1.1 Tracking model — [CODE] `background/tracker.js`

| Aspect | Implementation |
|---|---|
| Unit of measurement | Wall-clock seconds on the **active tab of the focused window** |
| Event sources | `chrome.tabs.onActivated`, `chrome.tabs.onUpdated` (url/title change on active tab), `chrome.windows.onFocusChanged`, `chrome.idle.onStateChanged` |
| Idle threshold | `chrome.idle.setDetectionInterval(60)` — 60 s. On `idle`/`locked`: flush + clear session |
| Window blur | Treated exactly like idle — flush, clear session, stop counting |
| Flush cadence | `setInterval` at `TICK_INTERVAL_MS = 60000` |
| Anti-inflation guard | `MAX_SINGLE_FLUSH_SECONDS = 1800` — no single flush may credit >30 min |
| Anti-inflation guard | `STALE_SESSION_SECONDS = 300` — a restored session older than 5 min is **discarded entirely** |
| Sub-second handling | `carryMs` remainder carried across flushes so short visits aren't lost |
| Midnight rollover | `flushActiveTime()` splits the elapsed span across `startKey`/`endKey` |
| Auto-highlight | `AUTO_HIGHLIGHT_SECONDS = 1800` — 30 min cumulative on a domain in a day mints a "Focused on {domain}" highlight |
| Blacklist | Substring match on lowercased URL; `chrome://`, `chrome-extension://`, `about:` always excluded |

### 1.2 What gets recorded per page — [CODE] `utils/formatters.js`

Two derived layers sit on top of raw domain/title, both built **only from `tab.url` and `tab.title`** — no content scripts, no page reads:

- `categorizeActivity()` — a hand-written substring cascade over the domain into 10 buckets: Development, Design, Productivity, Communication, Research, Entertainment, Social, News, Shopping, Other.
- `describeActivity()` — an "action + label" verb extractor with site-specific rules: GitHub/GitLab (`Reviewed PR #12 in dan/tasker`, `Issue`, `Reviewed commits`, `Read code`, `Browsed repo`), Jira/Linear ticket keys, Stack Overflow, YouTube, Google Docs/Sheets/Slides/Forms, Reddit subreddit, npm package, Notion, Figma, and search-engine `?q=` queries. Falls back to a cleaned title, then a humanized URL slug.
- `SENSITIVE_DETAIL_DOMAINS` — mail/bank/health domains get **domain only, no label**, even when not blacklisted. This is a genuinely good privacy detail that no competitor advertises.

### 1.3 Storage schema — [CODE] `utils/storage.js`

`chrome.storage.local` only. Explicitly **never** `chrome.storage.sync`.

```
tasker_settings          { isTrackingPaused, googleDriveFolderId, googleDriveFolderName,
                           aiSummariesEnabled, autoSyncDrive, autoSyncIntervalHours,
                           blacklistedDomains[], minFocusSeconds, hasSeenOnboarding }
tasker_active_session    { tabId, url, title, domain, category, action, label,
                           activityKey, startTime, lastActiveAt, carryMs, visitCounted }
tasker_install_id        random UUID, rate-limit only
day_YYYY-MM-DD           { dateKey, totalSeconds, categories{}, domains{}, pages{},
                           activities{ key -> {action,label,domain,category,seconds,
                           visits,firstAt,lastAt} }, sessions[] }
highlights_YYYY-MM-DD    [ {id, time, title, description, category, timestamp} ]
notes_YYYY-MM-DD         [ {id, time, text, timestamp} ]
recap_YYYY-MM            { monthKey, markdown, stats, timestamp }
last_sync_YYYY-MM-DD     { fileId, name, webUrl, syncedAt }
last_recap_sync_YYYY-MM  { ... }
```

Caps: `MAX_PAGE_KEYS_PER_DAY = 200`, `MAX_ACTIVITY_KEYS_PER_DAY = 300`. Past the cap, known keys keep accruing but no new keys are minted. Retention: `pruneOldData(180)` deletes `day_/highlights_/notes_` keys 180–580 days old, run on install/update **and** on the 6-hourly alarm.

**Notable: `day.sessions[]` is initialized in two places and written by nothing.** [CODE] Grep across `background/`, `utils/`, `dashboard/`, `popup/`, `options/` returns only the two default-initializers in `storage.js:155,163`. **Tasker has no timeline.** It knows *what* and *how much*, never *when*. Consequences are discussed in §3 and §5.

### 1.4 Focus score — [CODE] `formatters.js`

Derived on read, never persisted (`stripDerived()` deletes it before every write — a deliberate, correct choice, since the weights are expected to change). Weighted average of category share × `CATEGORY_WEIGHTS` (Development/Productivity 1.0 → Entertainment/Social 0.1, `Other` deliberately 0.5), scaled 0–100. Returns `null` below `MIN_SCORE_SECONDS = 600`, rendered as `—`. Monthly score uses the same function over the month's category mix.

### 1.5 Reports and sync — [CODE] `summarizer.js`, `driveSync.js`, `dashboard/`

- **Daily markdown** — `generateDailyMarkdown()`: header (date, total, score), highlights, notes, category breakdown, "What You Worked On" (top 15 activities with visit counts), top 10 domains.
- **Monthly recap markdown** — totals, days tracked, avg daily, monthly score, milestones (from highlights), category % breakdown, top 5 domains.
- **Drive sync** — `chrome.identity.getAuthToken` with the narrow `drive.file` scope only. Finds-or-creates a `Tasker Activity Logs` folder, multipart-uploads `Tasker_Daily_Log_YYYY-MM-DD.md` / `Tasker_Monthly_Recap_YYYY-MM.md`, PATCHing an existing file when the name matches. Auto-sync alarm every 360 min, **off by default** with an explicit comment saying a fresh install must not trigger a Google consent prompt on its own.
- **AI summary** — POST to `https://tasker-extension.onrender.com/v1/monthly-summary`, 10 s `AbortController` deadline, silent fallback to the rule-based summary. Payload is `{installId, monthKey, totalSeconds, daysTracked, categories{}}` — aggregate totals only, capped at 20 category names of 40 chars. The claim in the privacy policy that browsing history cannot be reconstructed from this payload is **accurate as written**.
- **Server** — `server/index.js`, zero-dependency Node, Gemini proxy. Quotas: 3 AI summaries per install per month, 300/day global, 20 s min between requests, 8 KB max body, optional extension-ID pinning.

### 1.6 Permission surface — [CODE] `manifest.json`

`tabs`, `storage`, `idle`, `identity`, `alarms`, `unlimitedStorage`. One host permission: the summary endpoint. **No `<all_urls>`, no content scripts, no `history`, no `downloads`, no `scripting`.** `STORE_LISTING.md` shows this was a conscious walk-back from an earlier `<all_urls>` draft. This is the single most valuable strategic asset in the codebase and every feature below is judged against whether it damages it.

### 1.7 Real technical constraints found in code

1. **The 60-second tick is longer than the MV3 idle-shutdown window.** [CODE + SOURCED + INFERENCE] MV3 service workers terminate after ~30 s without extension-API activity ([Chrome docs](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)). `TICK_INTERVAL_MS` is 60000, so on a quiet tab the worker is very likely dead before its own tick fires. Recovery then depends on `restoreSession()` — which **discards** anything older than `STALE_SESSION_SECONDS = 300`. Net effect: a 25-minute uninterrupted read on one page, with no tab switch and no idle transition, can be credited **zero seconds**. See §5 — this is the biggest risk in the product and it is a code bug, not a design tradeoff.
2. **`chrome.alarms` floor is 30 s** for released extensions; `periodInMinutes < 0.5` is ignored with a warning ([Chrome alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)). So a 1-minute alarm-driven heartbeat is legal and is the correct fix for (1).
3. **Storage quota** — `chrome.storage.local` is 10 MB (5 MB pre-Chrome 114); `unlimitedStorage` removes the cap ([Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)). Tasker already declares it, so per-day objects with `sessions[]` timelines are affordable. `storage.sync` is 100 KB total / 8 KB per item / 1,800 writes per hour — **far too small for any activity data**, which is why the "sync across machines" idea in §4 is not a small feature.
4. **Write amplification** — every flush writes the entire `day_` object. At one flush/min with a 300-activity day object this is a meaningful churn rate; `saveDayAndSession()` already halves it by batching the session into the same write. Any feature that adds a per-minute array (e.g. a timeline) must append to a *separate* key, not to `day_`.
5. **Sensitive-permission review** — `tabs` already guarantees manual Chrome Web Store review, as do `history`, `downloads`, `cookies`, `webRequest`, and any broad host pattern ([review process](https://developer.chrome.com/docs/webstore/review-process); [publishing checklist](https://extensionbooster.net/blog/chrome-web-store-publishing-requirements-2026-complete-checklist/)). Tasker is already in the manual-review lane, so a *new* permission does not change the lane — but it does add a justification the reviewer can reject, and it re-triggers the "requesting permissions not actually used" failure mode, one of the most common rejection reasons.

---

## 2. Market context

### 2.1 Where the incumbents sit

| Tool | Model | Where it leaves a gap |
|---|---|---|
| **Toggl Track** | Manual timer + 100+ integrations; Free (5 users), Starter $9/user/mo, Premium $18/user/mo | You must remember to press start. Approvals gated behind Premium; **no invoicing at all** ([Timely comparison](https://www.timely.com/blog/clockify-vs-toggl/)) |
| **Clockify** | Manual timer + admin depth; Standard $6.99/user/mo includes invoicing, approvals, scheduling ([Timely](https://www.timely.com/blog/clockify-vs-toggl/)) | Same start/stop discipline problem; built for an admin watching a team, not for one person's memory |
| **RescueTime** | Passive, cross-device, cloud; free Lite tier; owns Focus Sessions (actual site blocking) ([Rize comparison](https://rize.io/blog/rize-vs-rescuetime)) | Account + server required. Long-standing user privacy unease ([review roundup](https://www.choosingtherapy.com/rescuetime-app-review/)) |
| **Rize** | AI-coached desktop app, priciest tier ([Rize vs RescueTime](https://rize.io/blog/rize-vs-rescuetime)) | Desktop install, account, subscription |
| **Timing** | macOS-only automatic tracking | Mac only |
| **ActivityWatch** | Local, open-source, free, cross-OS, "your only real option if you won't send data to a third-party server" ([Rize's own admission](https://rize.io/blog/rescuetime-alternatives)) | **Tasker's most dangerous competitor.** Requires a desktop install and is aimed at hackers; the reports are queryable buckets, not a document you hand a client |
| **WakaTime** | Editor plugin, file/language/project/branch granularity, 50+ editors, free tier + ~$14/user/mo ([WakaTime](https://wakatime.com/time-tracking-for-developers)) | Sees only the editor. Blind to the browser |
| **Traqq** | Employer-side monitoring with blurred screenshots every 10 min ([Traqq blog](https://traqq.com/blog/does-time-tracking-software-take-screenshots/)) | Different buyer entirely (the boss, not the worker) |

### 2.2 Nika's question, answered plainly

> *What is Tasker's defensible advantage vs Toggl/Clockify?*

**The honest answer has three parts, and only one of them is a moat.**

**(1) The real, defensible difference — the artifact, not the timer.** Toggl and Clockify produce *time entries*: rows in a database you then have to turn into something. Tasker produces a *document* — a Markdown daily log and monthly recap, with a verb attached to each row ("Reviewed PR #12 in dan/tasker — 47m"), landing in a folder in your own Drive. Nobody in the passive-tracking category ships a "here is your month, written down, hand it to someone" output as the product's *point*. RescueTime gives you dashboards. ActivityWatch gives you buckets. Tasker gives you prose you can paste into a self-review. [INFERENCE] That is the defensible position, and Tasker is currently under-selling it: the README leads with "activity tracker" when the wedge is "the record you didn't write."

**(2) The zero-friction install.** No account, no login, no desktop binary, no subscription. Time-to-first-value is roughly 15 seconds. Toggl's free tier and Clockify's free tier are both genuinely generous, so "free" isn't a moat — but "free *and* nothing to sign up for *and* nothing to remember to press" compounds into a materially different funnel. [INFERENCE] This is a durable *acquisition* advantage but a weak *retention* one; it is copyable by any competent solo developer in a weekend.

**(3) Privacy as a real technical claim, not marketing.** `drive.file` scope only, no `<all_urls>`, no content scripts, aggregate-only AI payload, sensitive-domain title suppression. This is stronger than RescueTime's position, and unlike ActivityWatch it requires no install. [INFERENCE] This is defensible in *positioning* but not in *technology* — however, positioning moats are real when the incumbent structurally cannot follow. RescueTime cannot become local-first; its whole business is the server.

**Where the moat is thin — say this out loud:**

- **Chrome-only blindness is disqualifying for billing.** A freelancer who spends 40% of the day in VS Code, Figma desktop, Zoom, and Slack desktop gets a Tasker report that is confidently wrong. Toggl's manual timer, for all its friction, captures 100% of billable work because the human is the sensor. [INFERENCE] Tasker cannot win a head-to-head "which one do I invoice from" comparison, today or after any feature in this document.
- **No team layer at all.** No shared workspace, no roles, no approvals, no per-client rates, no invoicing. Clockify ships all of this at $6.99/user ([Timely](https://www.timely.com/blog/clockify-vs-toggl/)). Every one of those features requires a server and an account, which are exactly the two things Tasker's positioning forbids. **This is not a gap to close. It is a market to decline.**
- **No billing exports.** No CSV, no rounding rules, no rate maths, no client field. Even a solo freelancer cannot get an invoice out of Tasker without retyping.
- **No integrations.** Toggl's 100+ integrations ([Toggl](https://toggl.com/blog/clockify-alternatives)) are a distribution channel and a switching cost. Tasker has zero and, being an isolated extension with no host permissions, structurally cannot add most of them without permission creep.
- **Categorisation is a 40-line substring cascade.** [CODE] `docs.` maps to Research, so a company's internal docs subdomain becomes "Research"; `news` as a substring catches unrelated hostnames; every unrecognised work tool falls into "Other" at weight 0.5 and silently drags the focus score toward 50. A user whose stack is Airtable + HubSpot + Loom + Webflow will see most of their working day filed as "General Browsing."

**One-line answer to give Nika:** *"Toggl and Clockify sell a timer you have to remember. Tasker isn't competing on timers — it's the written record of your month that already exists by the time someone asks for it, with nothing to sign up for and nothing leaving your machine. Where they beat us is anything involving a client, a team, or an invoice, and we're not chasing that."*

### 2.3 Shabnam Katoch's signal: the marketer who said it helps "immensely"

Take the signal seriously but interrogate it. [INFERENCE] A marketer is close to Tasker's structurally *best* segment, because a marketer's job genuinely does happen inside a browser — Google Docs, Analytics, Ahrefs/Semrush, LinkedIn, HubSpot, Canva, YouTube Studio. The Chrome-only blindness that ruins Tasker for a developer barely bites a marketer. That is why the enthusiasm is real and why it should be treated as directional, not as proof of general fit.

But test the claim against the code, and four things a marketer needs are missing:

1. **"Social" is mis-scored for them.** [CODE] LinkedIn, X, Reddit, Instagram, and Facebook are all hard-coded to `Social` at weight **0.1**. For a social media marketer, that *is* the job. Tasker will show a great content-marketing day as a focus score in the 20s. This does not just annoy — it tells the user the tool doesn't understand them, and that is a churn event.
2. **YouTube is `Entertainment` at 0.1** — including YouTube Studio and competitor-research viewing.
3. **No campaign/client grouping.** A marketer's mental unit is "the Q3 launch," not "docs.google.com." Tasker has no concept above `domain`.
4. **Nothing to hand upward.** The monthly recap is a *personal* artifact. What a marketer actually needs on a Monday is "here is the week, grouped by campaign, in three bullets." [CODE] There is no weekly view anywhere — the dashboard has only Overview / Monthly Recap / Daily Logs / Drive Sync.

The single highest-leverage response to Shabnam's signal is not a new feature at all: it is **user-editable category weights and domain→category overrides**, so the tool stops arguing with its user about what their job is.

---

## 3. Segments, jobs, and features

### (a) Developers / engineers

**Job-to-be-done:** "Reconstruct what I actually shipped this sprint so I can fill in standup, the sprint review, and my promo packet without lying."

**Moment of pain:** Friday 16:40, the sprint retro doc is open and empty, and the week is a blur of PR reviews, a production incident, and one long doc-reading rabbit hole.

**Blunt framing:** [INFERENCE] This is the segment where Tasker is *most* likely to be installed (the audience is on Product Hunt and Reddit) and *least* likely to be trusted, because WakaTime already owns editor time at file/branch granularity ([WakaTime](https://wakatime.com/time-tracking-for-developers)) and a developer will immediately notice Tasker's hours are lower than reality. `describeActivity()`'s GitHub/Jira/Linear extraction is genuinely excellent and is the reason to keep serving this segment anyway.

| # | Feature | Files touched / MV3 approach | New perms / server / privacy cost | Effort | Impact | Used, or demo? |
|---|---|---|---|---|---|---|
| A1 | **Repo & ticket rollup** — group the day's activities by `owner/repo` and by ticket key (`ENG-412`) instead of by domain, with totals per repo/ticket | `formatters.js` (new `groupByProject()` keyed off the existing `activityKey` `domain\|action\|label` triple — the repo and ticket are *already parsed and stored*), render in `dashboard.js`, add to `generateDailyMarkdown()` | None. Pure re-aggregation of existing local data | **S** | **High** | **Used.** The data is already there; today it's just displayed in the wrong shape. Highest ratio in the document |
| A2 | **Standup draft** — one button producing "Yesterday: reviewed PRs #12/#14 in api-gateway (1h10m), worked ENG-412 (2h5m). Today: …" as copyable text | New `formatters.generateStandupText()`, button in `popup/popup.js` next to the existing `copySummaryBtn` | None (rule-based, offline). Optionally the AI path — but that would need the endpoint to accept *labels*, which breaks the aggregate-only guarantee. **Do the rule-based version only** | **S** | **High** | **Used.** Daily ritual, not an occasional one. Daily-use features retain; monthly ones don't |
| A3 | **Editor-time reconciliation banner** — detect that "Development" is the top browser category yet total tracked time is well under a working day, and show "Tracked 3h 10m in Chrome. Time in your editor, terminal and calls isn't counted." | `dashboard.js` overview panel, threshold constant in `formatters.js` | None | **S** | **High** | **Used — as trust infrastructure.** See §5. Not a feature users ask for; it's the one that stops them concluding the numbers are broken |
| A4 | **Deep-work session timeline** — populate the dead `day.sessions[]` with `{startMs, endMs, activityKey}` spans and render a horizontal day strip | `tracker.js` (append a span on each genuine activity switch — **write to a separate `sessions_YYYY-MM-DD` key**, not into `day_`, per constraint §1.7.4), `dashboard.js` renderer | None. Storage covered by `unlimitedStorage`. Adds a *when* dimension to local data — worth a line in the privacy policy for honesty even though nothing leaves the device | **M** | **Med** | **Borderline.** Beautiful in a screenshot; a developer looks at it twice. Its real value is that it unblocks A5 and B1 — build it as infrastructure, not as a feature |
| A5 | **Context-switch count** — "You switched context 47 times today; longest unbroken stretch 42m" | `formatters.js` over `sessions_` from A4, one stat tile in `dashboard.js` | None | **S** | **Med** | **Used.** It's the one number in this whole category that makes people quote the tool to a colleague. Cheap once A4 exists |

### (b) Freelancers & consultants who bill hours

**Job-to-be-done:** "Turn last month into a defensible invoice line item without under-billing myself."

**Moment of pain:** The 1st of the month. The invoice needs hours per client and there is no record, so they guess low out of guilt.

**Blunt framing — read this before building anything here:** [INFERENCE] This is the segment with the clearest willingness to pay and the **worst structural fit**. Money changing hands means the number must be *right*, and Chrome-only tracking is systematically low. Two decisions follow, and they are the most important product decisions in this document:
- **Do build** the manual reconciliation layer that lets a freelancer *correct* Tasker's number into a real one.
- **Do not build** anything that implies Tasker's number is invoice-ready on its own — no rates, no invoicing, no "amount due." That's Clockify's $6.99/user product ([Timely](https://www.timely.com/blog/clockify-vs-toggl/)) and the fight is unwinnable.

| # | Feature | Files touched / MV3 approach | New perms / server / privacy cost | Effort | Impact | Used, or demo? |
|---|---|---|---|---|---|---|
| B1 | **Client/project tagging by domain rule** — map domains and URL patterns to a user-defined project ("`*.acme.com`, `linear.app/acme` → Acme"), stored in settings, applied at render time so it retro-tags history | `options/options.js` (rule editor UI), `formatters.js` (`resolveProject()`), `storage.js` (`projectRules` in settings), all render paths | None. Purely local mapping. **Applying rules at read time, not write time, is essential** — it retro-tags existing history and lets a rule be fixed without corrupting stored data | **M** | **High** | **Used.** This is the single feature that converts "interesting" into "I need this on the 1st." Everything else in this segment depends on it |
| B2 | **Manual time block** — add an off-browser entry ("Client call, 45m, Acme") that merges into the day's totals | `storage.js` (new `manualEntries_YYYY-MM-DD` key, kept separate from tracked data), `dashboard.js` form, `formatters.js` merges into totals and **labels them "manual" in the markdown** | None. The separate key matters: never let a manual number be indistinguishable from a measured one | **M** | **High** | **Used.** The honest fix for Chrome-only blindness — the user is the sensor for the missing 40%. Also the thing that makes B3 defensible |
| B3 | **Timesheet CSV export** — `date, project, category, activity, hours, source(tracked\|manual)` | New `formatters.toTimesheetCsv()`, download button in `dashboard.js` via `Blob` + `URL.createObjectURL` — **exactly the pattern `options.js` already uses for JSON backup, so no `downloads` permission is needed** | None. Adding the `downloads` permission for a nicer save dialog would be permission creep for zero user benefit — see §4 | **S** | **High** | **Used.** Every freelancer already has an invoicing tool; they need Tasker's numbers *into* it. Cheap, and it makes Tasker a good citizen rather than a competitor to Clockify |
| B4 | **Rounding & minimum-increment rules** — "round to nearest 15 min, drop entries under 5 min" applied to the CSV and the monthly report | `formatters.js` rounding helper, setting in `options/options.js` | None | **S** | **Med** | **Used, quietly.** Small, unglamorous, and the exact detail that signals "built by someone who has actually invoiced." Ship alongside B3 |
| B5 | **Weekly client digest** — per-week, per-project summary a consultant can paste into a Friday client email | `formatters.js` (`getWeeklyStats()` mirroring the existing `getMonthlyStats()` key-range read), new dashboard tab | None | **M** | **Med** | **Used.** Weekly is the real cadence of client work; monthly-only is a mismatch. Also serves segments (c) and (e) — highest cross-segment reuse of any item here |

### (c) Marketers, researchers, content people

**Job-to-be-done:** "Show — to my boss, my client, or myself — where the week went across campaigns, and prove the research time was real work."

**Moment of pain:** Monday standup. "What did you do last week?" The honest answer is "a lot of reading, three drafts, and a competitor teardown," and it sounds like nothing.

**Blunt framing:** [INFERENCE] Structurally the best-fit segment (their whole job is in the browser), and the one Tasker's own defaults currently insult — see §2.3.

| # | Feature | Files touched / MV3 approach | New perms / server / privacy cost | Effort | Impact | Used, or demo? |
|---|---|---|---|---|---|---|
| C1 | **Editable category weights + domain overrides** — a settings table where the user re-weights categories and reassigns any domain ("linkedin.com → Productivity") | `formatters.js` (`CATEGORY_WEIGHTS` read from settings with the current map as the default — the code comment already anticipates this: *"kept in one place precisely so they can be overridden per user later"*), `options/options.js` UI, `storage.js` settings | None. Strictly local | **M** | **High** | **Used.** Not a feature so much as a *bug fix for the tool's opinion of its user*. Fixes the marketer, the community manager, the sales rep, and the recruiter in one change. **The single highest-impact item in this document** |
| C2 | **Custom categories** — let the user create "Client Work", "Learning", "Admin" beyond the fixed 10 | Same files as C1; `getCategoryMeta()` falls back to a generated colour for unknown keys (it already safely defaults to `Other`) | None | **M** | **Med** | **Used**, but only after C1. Ship them together; C1 alone is 80% of the value |
| C3 | **Research trail export** — for a chosen day/range, the ordered list of what was read on a topic, as Markdown links | `formatters.js` over `activities` (labels and domains are already stored; **URLs are not** — this exports titles + domains, not links) | None *if* it stays title-based. Storing full URLs per activity is a **real privacy escalation** — the current design deliberately keeps only domain + derived label, and `SENSITIVE_DETAIL_DOMAINS` exists to suppress even that. **Do not add URL storage for this.** | **M** | **Med** | **Borderline.** Researchers will love it; without URLs it's less useful, and with URLs it costs the privacy story. Ship the title-only version or not at all |
| C4 | **Campaign tagging** — B1's project rules, surfaced with campaign language and a manual "tag today's work as X" quick action | Shares B1's implementation entirely | None | **S** *(given B1)* | **High** | **Used.** Build B1 once, sell it twice |
| C5 | **Weekly "what I did" digest** — C-flavoured framing of B5 | Same as B5 | None | — | **High** | **Used.** Same code, different copy. This is the artifact this segment actually wants |

### (d) Students & self-directed learners

**Job-to-be-done:** "Prove to myself that I actually studied, and see where the four hours went when it felt like one."

**Moment of pain:** 23:00, closing the laptop, unsure whether the day counted.

**Blunt framing:** [INFERENCE] Large, loud, and low-value. Enthusiastic installs, near-zero willingness to pay, and it pulls the roadmap toward gamification and blocking — which is a direct fight with RescueTime's Focus Sessions, the one feature RescueTime is said to own outright ([Rize](https://rize.io/blog/rize-vs-rescuetime)). Serve them with features that already exist for other segments. Build almost nothing new.

| # | Feature | Files touched / MV3 approach | New perms / server / privacy cost | Effort | Impact | Used, or demo? |
|---|---|---|---|---|---|---|
| D1 | **Streak & consistency strip** — days-tracked streak and a 30-day mini-heatmap | `dashboard.js`, `storage.js` (a cheap key-range read like `getMonthlyStats()`) | None | **S** | **Med** | **Used.** Cheap dopamine that costs nothing and no permissions. The one gamification item worth having |
| D2 | **Study-goal target** — "2h of Research/Development per day," progress ring in the popup | `popup/popup.js`, one setting | None | **S** | **Med** | **Borderline.** Goals are set once and ignored by week three. Cheap enough to be worth the gamble; do not invest further if engagement data says no |
| D3 | **Subject grouping** — B1's project rules applied to course domains | Shares B1 | None | **S** *(given B1)* | **Med** | **Used.** Free rider on B1 |
| D4 | **Session recap on close** — end-of-day notification summarising the day | `service-worker.js` + a daily `chrome.alarms` trigger | **Needs the `notifications` permission.** Small but real permission creep, and MV3 makes "at close of browser" unreliable — you get "at a fixed hour" instead | **S** | **Low** | **Demo feature.** A daily notification from a time tracker is the fastest route to an uninstall. **Recommend against** |
| D5 | **Distraction blocking / focus mode** | Would need `declarativeNetRequest` + host permissions | **Severe.** Broad host access, a new sensitive permission, a fresh Store justification, and it makes Tasker a *blocker* — a different product with a different privacy story | **L** | **Low** | **Demo feature and a strategic error.** Listed only to be explicitly rejected. See §4 |

### (e) Managers & ICs who owe status updates and performance reviews

**Job-to-be-done:** "Write my self-review / weekly update from evidence instead of from the last two weeks I happen to remember."

**Moment of pain:** Review season. Six months to account for, and recency bias means January is a void.

**Blunt framing:** [INFERENCE] The segment where Tasker's *existing* output is closest to being the finished product, and where the annual/biannual cadence is the enemy — nobody keeps an extension installed for six months on the promise of a review artifact. The play is to make the *weekly* habit the hook and the review a compounding payoff.

| # | Feature | Files touched / MV3 approach | New perms / server / privacy cost | Effort | Impact | Used, or demo? |
|---|---|---|---|---|---|---|
| E1 | **Quarterly / arbitrary-range recap** — extend the monthly recap to any date range | `storage.js` (`getRangeStats()` generalising `getMonthlyStats()`'s key-range read — a mechanical refactor), `summarizer.js`, `dashboard.js` | None if rule-based. Sending a *quarter's* category totals to the AI endpoint is the same aggregate shape as today, so the privacy claim holds — but the server's 3-per-install-per-month quota must be checked so the feature doesn't silently fail | **M** | **High** | **Used.** Directly serves the "six months to account for" pain and reuses the strongest thing Tasker already builds |
| E2 | **Accomplishment inbox** — a keyboard-shortcut-driven "log a win" that captures the current tab's activity as context | `popup/popup.js`, `manifest.json` `commands` block, `storage.js` (`addHighlight` already exists and does most of it) | **`commands` is not a permission** — no new Store surface. Genuinely free | **S** | **High** | **Used.** Highlights are already the highest-signal data Tasker holds and the hardest to capture at the right moment. Lowering that friction to one keystroke is the best marginal change in this table |
| E3 | **Evidence-linked review draft** — group six months of highlights by theme into a review skeleton | `summarizer.js`, `formatters.js`. Rule-based grouping by category/project | Rule-based: none. **AI-assisted: would require sending highlight *text* to the server — a direct breach of the current "no notes or milestones ever leave the device" promise.** If ever built with AI, it must be a separate, explicitly-consented, off-by-default toggle with its own privacy-policy section | **M** | **High** | **Used, once or twice a year.** High value per use, low frequency — a retention *payoff*, not a retention *driver*. Correct to build; wrong to lead with |
| E4 | **Weekly status draft** — B5/C5 rendered as "This week: …" bullets | Shares B5 | None | **S** *(given B5)* | **High** | **Used.** The weekly habit that makes E3 possible six months later |
| E5 | **Team roll-up / manager view of reports' time** | Would require a server, accounts, and consent flows | **Fatal.** Breaks the no-account promise, breaks local-first, moves Tasker into the employee-monitoring category with Traqq ([Traqq](https://traqq.com/blog/does-time-tracking-software-take-screenshots/)), and invites a Store data-usage review Tasker would currently sail through | **L** | — | **Do not build.** See §4 |

---

## 4. DON'T BUILD

Plausible, frequently-requested, and actively harmful.

1. **Team / manager roll-ups (E5).** Needs a server, accounts, and consent. Destroys the no-account promise, converts the privacy policy from "there is no server to transfer from" into a data-processing disclosure, and lands Tasker in the employee-monitoring category. It is also a fight against Clockify's entire admin product at $6.99/user ([Timely](https://www.timely.com/blog/clockify-vs-toggl/)). **Decline the market.**
2. **Invoicing, hourly rates, "amount due."** Money demands correctness and Tasker is structurally low by exactly the amount of work that happens outside Chrome. Export CSV (B3) and let a real invoicing tool do the maths. Building this puts a wrong number next to a currency symbol — the fastest way to lose a user permanently.
3. **Site blocking / focus mode (D5).** Requires `declarativeNetRequest` plus broad host permissions, changes the product category, and attacks the one feature RescueTime is credited with owning ([Rize](https://rize.io/blog/rize-vs-rescuetime)). Broad host patterns are also a named rejection trigger ([review process](https://developer.chrome.com/docs/webstore/review-process)).
4. **A companion desktop agent for "full" tracking.** The obvious fix for Chrome-only blindness, and the wrong one. It abandons the 15-second install that is Tasker's actual advantage, puts it head-to-head with ActivityWatch (free, open-source, cross-OS, more mature) and Rize, and multiplies the support surface across three operating systems. Mitigate the blindness honestly instead (§5).
5. **Content scripts / page-content reading for "better categorisation."** Would require `<all_urls>` or per-site host permissions. `STORE_LISTING.md` documents that the broad host permission was *already removed* and the listing explicitly answers the reviewer's "why does a tracker need no host access?" **Re-adding it discards a settled review advantage and a documented privacy claim in one move**, for a categorisation improvement that C1 achieves for free.
6. **The `history` permission** to backfill past browsing. Sensitive, guarantees scrutiny ([review process](https://developer.chrome.com/docs/webstore/review-process)), and `chrome.history` has no dwell-time data anyway — it would produce *fabricated* durations, which is worse than no data.
7. **The `downloads` permission.** `options.js` already exports JSON via `Blob` + `URL.createObjectURL` + `a.click()`. B3's CSV uses the identical pattern. A new sensitive permission for a marginally nicer save dialog is pure creep.
8. **`chrome.storage.sync` for cross-device history.** 100 KB total, 8 KB per item, 1,800 writes/hour ([storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)) — physically impossible, and it would replicate browsing data to a Google account, contradicting the comment at the top of `storage.js`.
9. **Sending page titles, labels, notes, or highlights to the AI endpoint.** The current payload is genuinely aggregate-only and both the README and the privacy policy make that specific promise. Any richer AI feature (E3-with-AI, C3-with-URLs) must be a separately-consented, off-by-default channel with its own policy section — never a quiet widening of the existing one.
10. **Daily notification nags (D4).** Costs the `notifications` permission and is the classic uninstall trigger for a passive tool. The popup badge is sufficient.
11. **Achievements, badges, levels, leaderboards.** Leaderboards need a server. The rest cheapens a product whose credibility rests on being a sober record of work.
12. **A public/shareable profile page.** Server, account, and a browsing-data-goes-public story. Fatal to the positioning for a vanity feature.

---

## 5. The single biggest product risk

> **Tasker's numbers are systematically low, and a timesheet tool that is quietly wrong destroys its own credibility the first time a user checks it against reality.**

Two compounding causes — and the second is not a positioning problem, it is a bug:

**Cause 1 — structural (known, documented).** Chrome-only visibility. Editor, terminal, Zoom, Slack desktop, Figma desktop, and phone time are invisible. The README's Limitations section and the Store listing both disclose this honestly. [SOURCED context] WakaTime exists precisely because editor time is its own large bucket ([WakaTime](https://wakatime.com/time-tracking-for-developers)).

**Cause 2 — a code defect (undocumented, and worse).** [CODE + INFERENCE] `TICK_INTERVAL_MS` is 60 s; the MV3 service worker idles out after ~30 s. On a page with no tab/title churn, the tick very likely never fires because the worker is already dead. Recovery runs through `restoreSession()`, which **hard-discards** any session whose `lastActiveAt` is older than `STALE_SESSION_SECONDS = 300`. So the deepest, most valuable work — a 25-minute uninterrupted read of a long document, no tab switching, active enough that `chrome.idle` never fires — is the work most likely to be recorded as **zero**. The tool undercounts exactly the behaviour it claims to celebrate. Every guard in `tracker.js` is tuned against *over*-counting (`MAX_SINGLE_FLUSH_SECONDS`, `STALE_SESSION_SECONDS`, idle-on-blur) and nothing guards against under-counting.

*I have not instrumented this at runtime — it is read from the code and the documented worker lifecycle. Verify before acting: load unpacked, open one long article, leave it focused and scroll occasionally for 25 minutes, then check `day_` totals.*

### Mitigations — none requiring a desktop app

**M1 — Fix the heartbeat (S, do first, ships in v1.2).** Replace the 60 s `setInterval` with a `chrome.alarms` heartbeat at `periodInMinutes: 0.5`–`1`. Alarms wake a terminated worker; `setInterval` does not. `alarms` is **already declared**, so this costs no new permission and no Store justification. Then reconsider `STALE_SESSION_SECONDS`: with a reliable 60 s heartbeat the worst-case unflushed gap is ~1 minute, so the 5-minute discard becomes a safety net rather than the primary path. [INFERENCE] This alone is likely worth more measured accuracy than every feature in §3 combined.

**M2 — Show the shortfall instead of hiding it (S).** A3's reconciliation banner, generalised: when tracked time is materially below a plausible working day, say so on the dashboard — *"Tracked 3h 10m in Chrome today. Time in your editor, calls, and desktop apps isn't counted."* Counter-intuitive but correct: **a tool that names its own blind spot is trusted; one that presents a low number as the whole truth gets caught.** This converts the biggest weakness into a credibility signal, and it is the cheapest item in this document.

**M3 — Let the user fill the gap (M).** B2's manual time blocks, kept in a separate storage key and labelled `manual` in every export. The human is the sensor for the 40% Chrome cannot see. Combined with M2, Tasker's totals become *completable* by the user rather than *wrong* — which is the only honest version of an invoice-adjacent number without a desktop agent.

Optional fourth, lower confidence: [INFERENCE] a lightweight "was this a call?" prompt when a known meeting domain (`meet.google.com`, `zoom.us`, `teams.microsoft.com`) held focus for a long stretch, to catch the common case where a browser tab *is* the meeting. No new permissions — those domains already flow through `tabs`.

---

## 6. Ranked top 10 and release split

| Rank | Feature | Rel. | Effort | Rationale (one line) |
|---|---|---|---|---|
| 1 | **M1 — alarms-based heartbeat** | v1.2 | S | Every other feature reports numbers this bug is quietly deleting; nothing else matters until the measurement is sound |
| 2 | **C1 — editable category weights + domain overrides** | v1.2 | M | Stops the tool arguing with its user about what their job is; fixes marketers, community managers, and every "Other"-heavy stack at once |
| 3 | **M2 / A3 — reconciliation banner** | v1.2 | S | Naming the Chrome-only blind spot converts the product's biggest weakness into a trust signal, for a day's work |
| 4 | **A1 — repo & ticket rollup** | v1.2 | S | The repo and ticket are already parsed and stored; this is a rendering change that makes the developer report finally look like the work |
| 5 | **E2 — keyboard shortcut "log a win"** | v1.2 | S | Highlights are the highest-signal data Tasker holds and the hardest to capture in the moment; `commands` costs no permission |
| 6 | **B1 / C4 / D3 — project & client tagging rules** | v1.3 | M | The one feature that turns "interesting" into "needed on the 1st," and three segments share a single implementation |
| 7 | **B5 / C5 / E4 — weekly digest** | v1.3 | M | Weekly is the real cadence of client work, standups, and status updates; monthly-only is a cadence mismatch that costs retention |
| 8 | **B3 + B4 — timesheet CSV with rounding rules** | v1.3 | S | Makes Tasker feed the invoicing tool the user already has instead of picking a fight with Clockify — and needs no `downloads` permission |
| 9 | **B2 / M3 — manual time blocks** | v1.3 | M | The honest, desktop-app-free answer to Chrome-only blindness; kept in a separate key so measured and entered time are never confused |
| 10 | **A2 — standup draft** | v1.3 | S | A daily-ritual output; daily-use features retain users, monthly ones do not |

**Later (v1.4+), in rough order:** E1 quarterly/arbitrary-range recap · A4 session timeline (as infrastructure) + A5 context-switch count · C2 custom categories · D1 streak strip · E3 review-draft builder (rule-based only) · D2 study goals.

**Explicitly not scheduled:** everything in §4.

### Reading of the shape

[INFERENCE] The striking thing about this ranking is that **nine of the top ten are S or M, and five require no new data collection whatsoever** — they re-render, re-aggregate, or re-weight data Tasker already holds. `describeActivity()` is doing sophisticated work whose output is being flattened into a domain list. The gap between what Tasker *measures* and what it *shows* is currently larger than the gap between Tasker and its competitors. That is a good position to be in: the cheapest work available is also the highest-impact.

The strategic sentence: **Tasker should stop being a time tracker that produces reports, and become a work-record generator that happens to measure time.** Toggl and Clockify own the timer. Nobody owns the artifact.

---

## Sources

- [Clockify vs Toggl: 2026 Time Tracking Tool Comparison — Timely](https://www.timely.com/blog/clockify-vs-toggl/)
- [Rize vs RescueTime — Rize Blog](https://rize.io/blog/rize-vs-rescuetime)
- [The 5 Best RescueTime Alternatives in 2026 — Rize Blog](https://rize.io/blog/rescuetime-alternatives)
- [Best Privacy-First Time Tracking Software (2026) — Rize Blog](https://rize.io/blog/best-privacy-first-time-tracking-software-no-screenshots)
- [Time tracking for developers — WakaTime](https://wakatime.com/time-tracking-for-developers)
- [Best Time Tracking for Developers in 2026 — Rize](https://rize.io/best/time-tracking-for-developers-2026)
- [Does Time Tracking Software Take Screenshots? — Traqq Blog](https://traqq.com/blog/does-time-tracking-software-take-screenshots/)
- [7 Clockify Alternatives to Try in 2026 — Toggl Blog](https://toggl.com/blog/clockify-alternatives)
- [RescueTime App Review — ChoosingTherapy](https://www.choosingtherapy.com/rescuetime-app-review/)
- [Chrome Web Store review process — Chrome for Developers](https://developer.chrome.com/docs/webstore/review-process)
- [Chrome Web Store Publishing Requirements 2026 — ExtensionBooster](https://extensionbooster.net/blog/chrome-web-store-publishing-requirements-2026-complete-checklist/)
- [chrome.alarms API reference](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [chrome.storage API reference](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [MV3 service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
