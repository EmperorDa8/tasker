# Tasker — Release-Gate QA Report

**Reviewer:** QA (adversarial release gate)
**Date:** 2026-08-27
**Under review:** working tree at `C:\Users\Dan\Documents\vibe-coding-project\tasker` (manifest version 1.1.0, uncommitted changes to `background/*`, `utils/*`, `options/*`, `dashboard/*`, `popup/*`, `manifest.json`)
**Store status:** the extension is **already published** — `index.html:431` links to `https://chromewebstore.google.com/detail/tasker-activity-tracker-g/nfdjclnanladapnhofbmnhclkhlndeak`. This is therefore an **update submission**, not a first submission.

---

## VERDICT: **DO NOT SHIP**

One blocker (verified by running the code) makes the extension record up to **8 hours of phantom "focus time" per night** — it fabricates the exact number the whole product exists to report, and it directly contradicts a claim in the live Store listing. Two more HIGH findings are a silent data-loss race and a privacy claim the code does not honour. The minimum fix set is at the end.

Findings are marked **[RUN]** (verified by executing the code in a Node/`vm` harness with stubbed `chrome.*`) or **[READ]** (read the code and reasoned).

---

# BLOCKER

## B1. Idle detection is defeated by the new alarms heartbeat — phantom time accrues all night **[RUN]**

**Files:** `background/tracker.js:145-154` (`handleIdleState`), `background/tracker.js:36-43` (`constructor`), `background/tracker.js:66-69` (`init` → `syncCurrentTab`), `background/service-worker.js:121-129` (alarm handler), `background/tracker.js:398-401` (`startHeartbeat`)

**What's wrong.** Three defects combine:

1. `handleIdleState()` sets `this.isIdle = true`, flushes, and clears the *persisted* session — but unlike `handleWindowFocus()` (tracker.js:138-142) and `setPausedState()` (tracker.js:102-105) it **never sets `this.activeTab = null`**.
2. `isIdle` lives only in the tracker instance. It is **never persisted**, and `chrome.idle.queryState()` is **never called anywhere in the codebase** (verified: `grep -rn "queryState|getLastFocused" background/ utils/` → no matches). A new `ActivityTracker` always starts `isIdle = false`.
3. `init()` calls `this.syncCurrentTab()` **unconditionally** at line 68, which calls `switchTab()`, whose only guards are `trackingPaused` and `isIdle` — both false on a fresh instance.

Before this session, the per-minute `setInterval` died with the service worker, so nothing woke the extension while the user was away and no time was banked. The `tasker_tick` alarm now wakes a **fresh** service worker every 30 seconds, forever. Each wake runs top-level `initTracker()` → `init()` → `syncCurrentTab()` → `switchTab()`, which **restarts tracking on whatever tab was last active**, and the following `handleTick()` banks another 30 s. Nothing ever stops it: `chrome.idle.onStateChanged` does not re-fire `'idle'` while already idle.

**Reproduced [RUN]** (`vm` harness, real `tracker.js`/`storage.js`/`formatters.js`, stubbed `chrome`, controllable clock):

```
t=0    tracking: news.ycombinator.com
t=60s  idle fired. total = 60
       tracker.isIdle = true | tracker.activeTab still set? -> true
       persisted session cleared? -> true
-- service worker torn down; alarm wakes a fresh worker every 30s --
after 8 hours away, totalSeconds = 28830 = 8h
domains = {"news.ycombinator.com":28830}
EXPECTED: ~60s (the minute before the user left).
```

**Manual repro:** load unpacked, browse for a minute, then leave the machine alone (Chrome in the foreground) past the 60 s idle threshold. Come back in the morning; today's total is a full night of "focus".

**Honest caveat:** if Chrome itself is *not* the focused OS application when the machine idles, `chrome.tabs.query({active:true, currentWindow:true})` may return `[]` from a cold worker and the restart does not happen. The bug therefore fires reliably in the extremely common "walked away with Chrome in front / screen locked with Chrome in front" case, and intermittently otherwise. Intermittent fabrication of the headline metric is still a blocker.

**Why this is release-blocking beyond correctness:** the live Store listing (`STORE_LISTING.md`, "WHAT IT DOES") states *"Pauses on its own when you step away from the computer, so idle time is never counted as work."* `PRIVACY_POLICY.md` §6 and `privacy-policy.html:183` make the same claim for `idle`. The shipped behaviour contradicts a published listing claim.

**Fix (all three, together):**
```js
// tracker.js handleIdleState()
if (newState === 'idle' || newState === 'locked') {
  this.isIdle = true;
  await this.flushActiveTime();
  await TaskerStorage.clearActiveSession();
  this.activeTab = null;                       // (1) match the other pause paths
}

// tracker.js init(), replacing the bare syncCurrentTab() call
const state = await new Promise(r => chrome.idle.queryState(60, r));   // (2)
this.isIdle = (state !== 'active');
if (!this.isIdle) this.syncCurrentTab();                               // (3)
```
Call `chrome.idle.setDetectionInterval(60)` *before* `queryState` so the query uses the same threshold. Optionally also gate on `chrome.windows.getLastFocused()` returning a focused window.

**Regression test to add:** the harness above — assert that N heartbeat wakes after an `'idle'` event add zero seconds.

---

# HIGH

## H1. `applyToDay` read-modify-write race silently loses banked time **[RUN]**

**File:** `utils/storage.js:173-200` (`getDayData`) + `utils/storage.js:227-231` (`saveDayAndSession`), called from `background/tracker.js:240-293` (`applyToDay`)

`applyToDay` does `await getDayData()` → mutate the snapshot → `await saveDayAndSession()`. There is no lock. Two overlapping calls both read the same snapshot and the later write wins wholesale.

**Reproduced [RUN]** (20 ms simulated storage latency, two concurrent `applyToDay` on the same day):
```
applyToDay(100)+applyToDay(200) concurrently -> totalSeconds = 200   (expect 300)
domains = {"b.com":200}                                              ("a.com" vanished entirely)
```

**Reachability.** `flushActiveTime()` advances `this.activeTab.startTime` *synchronously* before its first `await` (tracker.js:311), which correctly makes a second concurrent flush a no-op — I verified this: 3 concurrent `flushActiveTime()` calls on a 60 s session credited exactly 60 s. So the race needs **≥1 s of wall clock to elapse between two flushes while the first `applyToDay` is still in flight** — a slow/contended `chrome.storage.local` round trip on a loaded machine, plus a tab event or alarm arriving in that window. The window is small but the loss is not: an entire flush (up to `MAX_SINGLE_FLUSH_SECONDS` = 1800 s) plus a whole domain/activity row disappears, with no error anywhere.

The same unguarded RMW pattern exists on `getHighlights`/`addHighlight` (`storage.js:236-258`), where `autoGenerateHighlight` (tracker.js:380-389) and a user's `ADD_HIGHLIGHT` message can genuinely overlap.

**Fix:** serialise all day/highlight writes behind a promise chain in `TaskerStorage`:
```js
_writeQueue: Promise.resolve(),
withDayLock(fn) { const p = this._writeQueue.then(fn, fn); this._writeQueue = p.catch(()=>{}); return p; }
```
and wrap the body of `applyToDay` (and `addHighlight`/`deleteHighlight`/`addNote`/`deleteNote`) in it.

---

## H2. Memoised `initTracker()` promise poisons the session permanently on any rejection **[RUN]**

**File:** `background/service-worker.js:44-58`, with `background/service-worker.js:5-15`

```js
let trackerReady = null;
async function initTracker() {
  if (!trackerReady) { trackerReady = (async () => { ... })(); }
  return trackerReady;   // a REJECTED promise is cached forever
}
```

**Reproduced [RUN]:**
```
first call rejected: boom
second call ALSO rejected: boom   <-- permanently poisoned
```

**Reachability is real, not theoretical.** `importScripts` at line 5-15 is wrapped in `try/catch` that only `console.error`s. If any script fails to load, `ActivityTracker` is `undefined`, `new ActivityTracker()` throws, `trackerReady` caches the rejection, and **every** tab/window/idle/command/alarm listener's `await initTracker()` rejects for the rest of the worker's life — as an *unhandled* rejection, because none of those listeners (service-worker.js:72-94, 111-118, 121-129) has a `try/catch`. The extension is silently dead with nothing in the UI to say so. `handleAsyncMessage` is the only caller that surfaces the failure (via the `.catch` at line 156).

**Fix:**
```js
trackerReady = (async () => { ... })().catch(err => { trackerReady = null; throw err; });
```
plus a `try/catch` in each listener, and drop the `try/catch` around `importScripts` (a load failure should be loud, not swallowed).

---

## H3. Privacy policy states financial information is not collected; the code collects it **[RUN]**

**Files:** `utils/formatters.js:462-471` (`SENSITIVE_DETAIL_DOMAINS`), `utils/formatters.js:500-594` (`describeActivity`), `utils/storage.js:124` (default blacklist), `background/tracker.js:355-378` (`logCurrentWin`)

`PRIVACY_POLICY.md` §1 and `privacy-policy.html:143`: *"Tasker does **not** collect or handle: … health or financial information …"*

`SENSITIVE_DETAIL_DOMAINS` covers `bank, paypal, chase, amex, wellsfargo, capitalone, fidelity, schwab, mychart, healthcare` and the mail providers. It misses every neobank and most challenger banks. The default exclusion list (`storage.js:124`) is only `['bank','paypal','passwords','accounts.google.com']`.

**Reproduced [RUN]:**
```
monzo (not in sensitive list) => {"action":"Read","label":"Balance: 1,234.56"}
gmail                        => {"action":"Visited","label":"mail.google.com"}   (correctly redacted)
mychart                      => {"action":"Visited","label":"mychart.x.org"}     (correctly redacted)
google search query          => {"action":"Searched","label":"how to quit my job"}
```

That label is stored in `day_*.activities`, rendered in the dashboard, and written verbatim into the Drive-synced Markdown by `generateDailyMarkdown` ("What You Worked On"). It is **not** sent to onrender.com — see PASS-3.

**The new `Alt+Shift+L` shortcut makes this worse, which is what the change request asked about.** `logCurrentWin` correctly refuses on a *blacklisted* tab (`activeTab` is null there) and correctly redacts a *`SENSITIVE_DETAIL_DOMAINS`* tab (label is the bare domain — verified above). But on `monzo.com` / `revolut.com` / `wise.com` / `n26.com` / `starling.bank`… one keypress files **"Read: Balance: 1,234.56"** as a permanent highlight that syncs to Drive. Same for `"Searched: how to quit my job"` on any search engine.

**Fix — pick one, do it before submitting:**
- (a) Extend `SENSITIVE_DETAIL_DOMAINS` with the common neobanks/brokerages and, more importantly, make `logCurrentWin` refuse (or fall back to domain-only) when `describeActivity` produced a title-derived label rather than a structurally-parsed one; **and**
- (b) soften the policy sentence to what the code actually guarantees: *"Tasker records page titles. It suppresses title detail on known email, banking and health domains, and on any site you exclude — but a title on an unrecognised financial site may still be recorded locally."*

(b) alone is sufficient for policy accuracy; (a) is what the feature deserves. Do not ship the current combination of the shortcut and the current policy wording.

---

# MEDIUM

## M1. `startHeartbeat()` re-creates the alarm on every init, which can starve the heartbeat **[READ]**

**File:** `background/tracker.js:398-401`, called from `init()` at line 72

Chrome docs: *"If there is another alarm with the same name … it will be cancelled and replaced by this alarm."* ([chrome.alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms)) — creating replaces and **restarts the period**, it does not update in place. `init()` runs once per service-worker lifetime, and the worker is torn down after ~30 s idle, so under continuous event traffic (rapid tab switching, window focus changes) the alarm is reset before it can fire and the heartbeat never runs. In that specific case tab events flush anyway, so no time is lost — but the mechanism is silently not doing its job, and it is not what the comment at lines 391-397 claims.

**Fix:**
```js
startHeartbeat() {
  if (!chrome?.alarms) return;
  chrome.alarms.get(HEARTBEAT_ALARM, a => {
    if (!a) chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MINUTES });
  });
}
```

## M2. `periodInMinutes: 0.5` requires Chrome 120+; no `minimum_chrome_version` is declared **[READ]**

**Files:** `background/tracker.js:31`, `manifest.json`

`0.5` is exactly the honoured minimum — *"Chrome limits alarms to at most once every 30 seconds… setting `delayInMinutes` or `periodInMinutes` to less than `0.5` will not be honored and will cause a warning"* ([chrome.alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms)) — but the 30 s floor only landed in **Chrome 120**; before that the floor was 60 s ([What's new in Chrome 120 for Extensions](https://developer.chrome.com/blog/chrome-120-beta-whats-new-for-extensions)). The comment at tracker.js:29 ("0.5 is the shortest period Chrome honours") is correct **only for Chrome ≥ 120**. On older packed builds the period is silently clamped to 60 s with a console warning. Note also that the 30 s floor is not enforced at all for **unpacked** extensions, so local testing will not reveal the clamp.

Consequence on Chrome < 120 is mild (60 s heartbeat vs the 300 s `STALE_SESSION_SECONDS` window), but it should be declared.

**Fix:** add `"minimum_chrome_version": "120"` to `manifest.json`.

## M3. `recap_*`, `last_sync_*`, `last_recap_sync_*` are never pruned — unbounded growth and a retention hole **[READ]**

**Files:** `utils/storage.js:410-426` (`pruneOldData`), `background/summarizer.js:64`, `background/driveSync.js:190,202`

`pruneOldData` only removes `day_*`, `highlights_*`, `notes_*`. Three key families grow forever:

- `last_sync_<date>` / `last_recap_sync_<month>` — one key per synced day/month, small but unbounded.
- **`recap_<month>`** — stores `{ markdown, stats: monthStats }`, and `monthStats` contains the entire `activities` map plus `topActivities` and `milestones` for that month. This is a **full copy of a month's activity labels** (including the search queries and titles from H3) that **survives the 180-day prune of the underlying `day_*` keys**. The retention policy is silently defeated for any month the user opened a recap for.

Separately, `pruneOldData(180, lookbackDays=400)` only sweeps days 180-580 back; a profile that goes >400 days without the extension running keeps older data forever. Minor by comparison.

**Fix:** extend `pruneOldData` to delete `recap_*`, `last_sync_*`, `last_recap_sync_*` outside the retention window (derive month keys the same way day keys are derived), and drop `stats.activities` from what `summarizer.js:64` persists — the markdown already contains everything the UI needs.

## M4. `autoSyncIntervalHours` is a dead control — the UI lies **[READ]**

**Files:** `dashboard/dashboard.js:618` (writes it), `utils/storage.js:123` (default `24`), `background/service-worker.js:25` (hard-codes `periodInMinutes: 360`)

The dashboard's "auto sync frequency" select writes `autoSyncIntervalHours`; **nothing ever reads it**. The sync alarm is fixed at 6 hours and is created only in `onInstalled`. Verified by exhaustive grep: the only three occurrences are the write, the default, and… nothing.

Related: `tasker_auto_drive_sync` is created **only** in `onInstalled`, whereas `tasker_tick` is re-registered on every init. If the sync alarm is ever lost, the 6-hourly prune and auto-sync stop permanently. Inconsistent hardening.

**Fix:** either honour the setting (re-create the alarm in `SAVE_SETTINGS` and in `init()`) or remove the control from the dashboard. Also re-register `tasker_auto_drive_sync` alongside the heartbeat.

**Also dead:** `minFocusSeconds: 30` (`storage.js:125`) is never read anywhere.

## M5. Domain category overrides do not apply to history, but weights do — inconsistent and unexplained **[READ]**

**Files:** `options/options.js:205-217`, `utils/formatters.js:302-325`, `utils/storage.js:197`

Category **weights** are applied at read time (`getDayData` derives `productivityScore` on every read), so moving a slider retroactively changes historical scores. **Domain overrides** are applied at *write* time (`categorizeActivity` runs in `switchTab`), so `day_*.categories` for past days keeps the old classification. Setting "LinkedIn is Productivity" changes tomorrow's score but not yesterday's, with nothing in the UI saying so. Users will report this as a bug.

**Fix:** a one-line note under the site-rules list in `options/options.html`: *"Site rules apply to time recorded from now on. Category weights apply to your whole history."*

## M6. Coverage timestamps are write-times, so a midnight-crossing session mis-attributes them **[READ]**

**Files:** `background/tracker.js:282-283` (`firstAt`/`lastAt` = `Date.now()`), `utils/formatters.js:393-423` (`computeCoverage`), `utils/formatters.js:730-745` (`generateDailyMarkdown`)

`firstAt`/`lastAt` record when the *flush* happened, not when the activity happened. In `flushActiveTime`'s midnight branch (tracker.js:327-337) the pre-midnight portion is written to *yesterday's* day object with `Date.now()` — a timestamp that falls on **today**. `computeCoverage` on that day then reports a span that extends past the day boundary, and `formatCoverageNote` prints clock times that never happened on that date. The banner is only rendered for today (dashboard.js:226), which limits UI exposure, but `generateDailyMarkdown` calls `computeCoverage` for **any** day, so a wrong coverage sentence can be written into a Drive-synced log for a past date.

**Fix:** pass the true observation timestamps into `applyToDay` (`startedAtMs` and `now` are already computed in `flushActiveTime`) instead of calling `Date.now()` inside it, and clamp `firstAt`/`lastAt` to the day being written.

## M7. Neither privacy policy lists the `onrender.com` host permission **[READ]**

**Files:** `PRIVACY_POLICY.md` §6, `privacy-policy.html:175-187`, `manifest.json` `host_permissions`

Both permission tables list `tabs, storage, unlimitedStorage, idle, identity, alarms` and omit `https://tasker-extension.onrender.com/*` entirely. The policy text does describe the summary service in §3, and `STORE_LISTING.md` has a host-permission justification, but the user-facing table is incomplete — and the neighbouring sentence *"Tasker has no host access to the sites you visit"* reads as "no host permissions" to a lay reader. A reviewer comparing the manifest to the policy will notice.

**Fix:** add a row: `https://tasker-extension.onrender.com/* — to reach Tasker's own summary service when AI monthly summaries are switched on. No other site is covered.`

## M8. `PRIVACY_POLICY.md` and `privacy-policy.html` have diverged **[READ]**

`privacy-policy.html:128` — Effective Aug 8, **Last updated Aug 27**, and its `alarms` row (line 185) was rewritten for the new heartbeat ("wake up and record the time you have spent, roughly twice a minute").
`PRIVACY_POLICY.md` — still "Last updated: August 8, 2026" with the old `alarms` text ("To schedule optional automatic Drive backups").

The HTML is the live/linked copy, so users see the correct version, but the repo's source of truth now contradicts the published document.

**Fix:** sync `PRIVACY_POLICY.md` to the HTML (or generate one from the other).

## M9. `PUBLISHING_CHECKLIST.md` is stale in ways that will mislead the release **[READ]**

- §1 says *"the `oauth2.client_id` in `manifest.json` is a **placeholder** (`REPLACE_WITH_YOUR_CLIENT_ID…`)"*. It is **not** — `manifest.json` carries a real client ID `141484094117-9hnj10hh530mivabuoqjv7574tnmgu5m.apps.googleusercontent.com`.
- §2 describes obtaining an item ID via a first upload. The item is **already published** (`nfdjclnanladapnhofbmnhclkhlndeak`, per `index.html:431`), so §2 and §3 no longer apply.
- The whole document is framed as a first submission; this is an update. There is no "what to do for an update" path (bump version → rebuild → upload → resubmit; listing/privacy tabs only change if disclosures changed).
- §1 and §4 reference `tasker-v1.1.0.zip`, which will be the wrong artifact.
- The final "Quick blocker list" still lists the $5 fee and the placeholder client ID as outstanding.

**Fix:** rewrite as an update checklist.

## M10. Popup live timer keeps counting while idle / on an excluded page **[READ]**

**File:** `popup/popup.js:126-131`

The 1 s ticker increments `currentSeconds` whenever the toggle is not in the `paused` class. It has no idea whether the tracker actually has an active session — it will keep counting while the user is idle, while the active tab is blacklisted, or while the window is unfocused. It corrects itself on the next `refreshPopupData()`, so the error is transient, but it visibly disagrees with the real number.

Declaring `currentSeconds`/`timerTicker` (change #7) is a genuine fix and is correct — see PASS-6 — this is the remaining behavioural gap.

**Fix:** gate the tick on `data.activeTab` being non-null from the last `GET_STATUS`, and re-poll `GET_STATUS` every ~10 s while the popup is open.

---

# LOW

## L1. `Alt+Shift+L` is wrong on macOS and is not read back from Chrome **[READ]**

**Files:** `manifest.json` `commands.log_win.suggested_key.default`, `popup/popup.html:154`, `options/options.html:140`, `index.html:492`

`"default"` maps `Alt` to `Option` on macOS, so the real binding there is **Option+Shift+L**, yet three surfaces hard-code the string "Alt+Shift+L". The UI also does not reflect a user who rebinds via `chrome://extensions/shortcuts`.

Conflicts: the binding is valid per Chrome's rules (a `Ctrl` or `Alt` is required; `Ctrl+Alt` is prohibited; ≤4 suggested keys) and is not a reserved Chrome shortcut ([chrome.commands](https://developer.chrome.com/docs/extensions/reference/api/commands)). On Linux/GNOME, `Alt+Shift` is a common keyboard-layout-switch chord for multi-layout users; on Windows it is free. Not a blocker.

**Fix:** add `"mac": "Command+Shift+L"` (or `Alt+Shift+L` mapped explicitly) to `suggested_key`, and render the label from `chrome.commands.getAll()` at runtime instead of hard-coding it.

## L2. `rollupWork` string-concatenates when `seconds` is a string **[RUN]**

**File:** `utils/formatters.js:678-712`

```
rollup: seconds as string => [{"type":"repo","key":"dan/tasker","seconds":"0900", ...}]
```
`group.seconds += activity.seconds` with `0 + "900"` yields `"0900"`; a second entry would give `"0900600"`. `computeProductivityScore` correctly guards this with `Number(cats[name]) || 0` (formatters.js:361) but `rollupWork` does not. Only reachable from hand-edited or externally-restored storage — there is no import path today — so LOW.

**Fix:** `group.seconds += Number(activity.seconds) || 0;` and the same for `visits`.

## L3. `deriveWorkKey` false-positives on any two-segment label under a repo action **[RUN]**

**File:** `utils/formatters.js:629-655`
```
deriveWorkKey({action:'Read code', label:'AC/DC'}) => {"type":"repo","key":"AC/DC"}
```
In practice `Read code`/`Browsed repo`/`Reviewed commits` are only emitted for github.com/gitlab.com paths, where the label really is `owner/repo`, so this is theoretical. Worth a guard if the action set ever widens.

## L4. AI response shape is trusted **[READ]**

**File:** `background/summarizer.js:56-59`

`aiInsights.milestones` replaces `monthStats.milestones` with no validation of type or element shape. `server/index.js` does sanitise and cap the fields it returns, but the extension must not depend on its own server behaving. If the endpoint ever returns a non-array, `renderMonthlyMilestones` (dashboard.js:395-398) reads `.length` on it and then `forEach`s — a `TypeError` that kills the recap render.

**Fix:** `Array.isArray(aiInsights.milestones) ? aiInsights.milestones.filter(m => m && typeof m.title === 'string') : monthStats.milestones`.

## L5. `formatClockTime` hard-codes `en-US` **[READ]**

`utils/formatters.js:428-430` uses `toLocaleTimeString('en-US', …)` while `storage.js:249,286` use `toLocaleTimeString([], …)`. A non-US user gets AM/PM in the coverage banner and 24-hour times everywhere else.

## L6. Server allows any extension origin when `ALLOWED_EXTENSION_IDS` is unset **[READ]**

`server/index.js` `originAllowed()` returns `true` for **any** `chrome-extension://` origin when the env var is empty. Not a Web Store issue (it is your server, not the extension), but it means anyone can burn your Gemini quota. Pin `ALLOWED_EXTENSION_IDS=nfdjclnanladapnhofbmnhclkhlndeak` before this update goes live.

## L7. `chrome.storage.local.clear()` races the live tracker **[READ]**

`options/options.js:271-280` clears storage while the service worker still holds `this.activeTab` in memory; the next flush immediately re-creates a `day_*` key and a session. The user sees "history cleared" and a non-zero total seconds later. Send a message to the worker to pause + null the session before clearing.

---

# PASS — things I tried to break and could not

**PASS-1. No double-counting from the alarm wake. [RUN]** The specific concern in the change request — alarm wake runs top-level `initTracker()` → `restoreSession()` → `flushActiveTime()`, *then* `handleTick()` → `flushActiveTime()` — is genuinely a no-op the second time. `flushActiveTime` advances `this.activeTab.startTime = now` at line 311, **synchronously, before any `await`**, so the second call computes sub-second elapsed and returns at line 316. Verified: a 60 s session credited exactly 60 s after `init()` + `handleTick()`, and exactly 60 s under three fully concurrent `flushActiveTime()` calls.

**PASS-2. Every `innerHTML` sink escapes. [READ, exhaustive]** I enumerated all 40 `innerHTML`/`insertAdjacentHTML`/`outerHTML` occurrences across `popup/`, `dashboard/`, `options/`, `background/`, `utils/`. Every interpolation of attacker-controlled data (page titles, URLs, domains, note text, highlight titles, note ids) passes through `Formatters.escapeHtml`. The remaining assignments are static literals or `originalHTML` round-trips. No `eval`, no `new Function`, no `document.write`, no `javascript:` URLs, no inline `on*` handlers, no inline `<script>` blocks, and no external resource references in any HTML or CSS (fonts are local `.woff2`). CSP `script-src 'self'; object-src 'self'; img-src 'self' data:` is satisfied.

**The two new renderers are clean, as claimed.** `renderCoverage` (dashboard.js:149-160) uses only `textContent`. `renderWorkRollup` (dashboard.js:169-213) builds every node with `createElement`/`createTextNode`/`textContent` — including `key.appendChild(document.createTextNode(group.key))`, which is the right call since `group.key` is URL-derived. `recapExecutiveSummary.textContent = stats.aiSummaryParagraph` (dashboard.js:371) means **server-returned text cannot inject markup**, and AI milestones flow through the escaping `renderMonthlyMilestones`. Verified, not assumed.

**PASS-3. The onrender.com payload matches the privacy claim exactly. [READ, line-by-line]** `summarizer.js:81-104` sends exactly `{ installId, monthKey, totalSeconds, daysTracked, categories }`, where `categories` is capped at 20 entries, keys truncated to 40 chars, values `Math.round`ed. No URL, no page title, no domain, no note, no highlight, no activity label, no search query. `server/index.js` `validPayload` independently rejects anything else, and `callGemini` builds its prompt only from those five fields. The claim in `PRIVACY_POLICY.md` §3 and `STORE_LISTING.md` holds.

**PASS-4. No remote code. [READ]** Nothing is `importScripts`'d, `fetch`'d-and-`eval`'d, or injected from the network. `summarizer.js` receives JSON data and renders it as text. This satisfies the MV3 remotely-hosted-code prohibition.

**PASS-5. `commands` adds no install-time permission warning. [READ + docs]** The `commands` manifest key requires no permission and produces no new warning on the install screen ([chrome.commands](https://developer.chrome.com/docs/extensions/reference/api/commands)). The existing warning set (from `tabs`) is unchanged, so **this update will not force existing users through a re-consent prompt**. `chrome.action.setBadgeText` is the correct MV3 API (not `chrome.browserAction`), and the top-level clear at service-worker.js:63-65 correctly handles a badge stranded by worker suspension.

**PASS-6. `stripDerived` is applied on every write path. [RUN]** Both `saveDayData` (storage.js:205-208) and `saveDayAndSession` (storage.js:227-231) strip `productivityScore`; verified that neither leaves the field in the stored object. No other code path writes a `day_*` key.

**PASS-7. A weight of exactly `0` works end to end. [RUN]** `collectWeightOverrides` stores `0` (it compares `!==` against the default, not truthiness); `applyPreferences` accepts it (`Number.isFinite(0)` is true, then clamped into `[0,1]`); `computeProductivityScore` uses `weights[name] !== undefined` rather than a falsy check, so `0` is honoured rather than falling back to `Other`. Verified: `CATEGORY_WEIGHTS.Development === 0` and a Development-only day scores `0`. Non-finite values are ignored and out-of-range values clamp: `'abc'→1.0` (default retained), `5→1`, `-3→0`. No falsy-check bug anywhere on this path.

**PASS-8. 1.1.0 → new-version migration does not throw. [RUN]** `computeCoverage` returns `null` (no exception) for: a day with no `activities` key at all, activities lacking `firstAt`/`lastAt`, string timestamps, `null` entries, `undefined` dayData, and a 10-second day. `rollupWork` returns `[]` for a legacy day and for entries missing `action`/`label`. `getDayData` defaults `activities`/`sessions` for old objects (storage.js:191-192), and `rankActivities` falls back to the flat `pages` map. Domain overrides match subdomains correctly and do **not** match a lookalike domain (`evillinkedin.com` is not caught by a `linkedin.com` rule). First-run with no data renders empty states everywhere.

**PASS-9. `chrome.idle.setDetectionInterval(60)` still runs before it matters. [READ]** It stayed in `init()` (tracker.js:62-64), which the top-level `initTracker()` invokes on the worker's first turn. The `chrome.idle.onStateChanged` listener is now registered synchronously at service-worker.js:89-94, so no idle event can be missed during a cold start. Moving the listeners to top-level registration is correct MV3 practice and I found no gap in it. (`setDetectionInterval` should move *above* the `queryState` call added for B1.)

**PASS-10. `build_zip.py` packages exactly the right files. [RUN]** I executed `build_zip.collect()`. It is allowlist-based (`INCLUDE_DIRS = assets, background, dashboard, options, popup, utils` + `manifest.json`), so `server/`, `marketing/` (including its 100 MB+ `node_modules`), `.git/`, the existing `tasker-v*.zip` files, `*.md`, `screenshots/`, `index.html`, `privacy-policy.html`, and the build scripts are all excluded. It correctly drops `assets/_previous/` and the promo images. All 28 shipped files are runtime-necessary; every new file added this session lives inside an already-included directory, so nothing is missing. The `preflight()` placeholder check and the manifest/summarizer host-match check are good practice and pass. **No changes needed to the build script.**

**PASS-11. All JS parses.** `node --check` clean on every file in `background/`, `utils/`, `popup/`, `options/`, `dashboard/`.

---

# Web Store listing — required changes

1. **Version must be bumped.** `manifest.json` is still `1.1.0`, which is the published version — the dashboard will reject the upload. Ship as **`1.2.0`** (new user-facing features: keyboard shortcut, category weights, site rules, coverage banner, repo/ticket rollup — a minor bump, not a patch). Build with:
   ```
   python build_zip.py --version 1.2.0 --service-url https://tasker-extension.onrender.com
   ```
   which produces `tasker-v1.2.0.zip`.
2. **Add `"minimum_chrome_version": "120"`** (M2) — also worth telling the reviewer, since it explains the 30 s alarm period.
3. **Detailed description** does not mention any of the five new features. Add a line for the shortcut, the weights/site-rules control, and the "browser time only" honesty banner. The banner in particular is a positive differentiator for a time-tracking listing.
4. **Correct the `alarms` permission justification.** `STORE_LISTING.md` currently claims alarms are used for *"finalizing daily summaries at day rollover"* — **there is no day-rollover alarm**. Replace with: *"a 30-second heartbeat that banks in-progress tab time before Chrome suspends the MV3 service worker, and a 6-hourly job that prunes history past the retention window and runs the user's optional Drive sync."*
5. **Add the host permission to both privacy-policy permission tables** (M7).
6. **Sync `PRIVACY_POLICY.md` to `privacy-policy.html`** and bump its Last-updated date (M8).
7. **Fix or soften the "no financial information" claim** (H3) — this is the one listing/policy item that is not merely incomplete but contradicted by shipped behaviour.
8. **Data-usage disclosures need no change.** The new features derive from data already disclosed under *Web history* + *User activity*; nothing new is transmitted. The existing certifications remain accurate.
9. **Pin `ALLOWED_EXTENSION_IDS`** on the Render service to the published item ID before this version reaches users (L6).
10. **Rewrite `PUBLISHING_CHECKLIST.md` as an update checklist** (M9) — the current one will actively mislead whoever runs the release.

---

# Minimum set of fixes required to ship

| # | Finding | Fix |
|---|---|---|
| 1 | **B1** | Null `activeTab` in `handleIdleState`; call `chrome.idle.queryState()` in `init()` and skip `syncCurrentTab()` unless `'active'`. **Non-negotiable.** |
| 2 | **H2** | `.catch(e => { trackerReady = null; throw e; })` on the memoised promise; `try/catch` in each top-level listener. |
| 3 | **H3** | Soften the "no financial information" policy sentence **and/or** make `logCurrentWin` refuse title-derived labels on unrecognised financial domains. |
| 4 | **Listing 1** | Bump to `1.2.0` and rebuild the zip. |
| 5 | **Listing 4** | Correct the false `alarms` justification before a reviewer reads it. |

Strongly recommended in the same release (cheap, and each is a real defect): **H1** (write lock), **M1** (`alarms.get` before create), **M2** (`minimum_chrome_version`), **M4** (remove or honour the dead frequency control), **M7/M8** (policy tables and doc sync).

Everything else can wait for 1.2.1.

---

## Verification artifacts

Harnesses (Node + `vm`, real source files, stubbed `chrome.*`, controllable clock) written to the session scratchpad:
- `h1.js` — formatters: legacy/malformed day shapes, coverage, rollup, weights incl. `0`, sensitive-domain redaction
- `h2.js` — tracker/storage: cold-wake double-flush, concurrent flushes, `applyToDay` lost update, `stripDerived`, poisoned memoised promise
- `h3.js` — B1 end-to-end: idle → worker teardown → 960 heartbeat wakes → 8 h phantom time

## Documentation cited

- [chrome.alarms API reference](https://developer.chrome.com/docs/extensions/reference/api/alarms) — 30 s clamp, unpacked exemption, same-name replacement
- [What's new in Chrome 120 for Extensions](https://developer.chrome.com/blog/chrome-120-beta-whats-new-for-extensions) — 60 s → 30 s alarm minimum
- [chrome.commands API reference](https://developer.chrome.com/docs/extensions/reference/api/commands) — no permission warning, modifier rules, reserved shortcuts, 4-suggested-key limit
