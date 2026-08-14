# Chrome Web Store Listing — Tasker

Ready-to-paste content for the Chrome Web Store Developer Dashboard.

---

## Extension name

Tasker - Activity Tracker & Google Drive Recap

## Short description (max 132 characters — this one is 118)

Local-first browsing activity tracker with daily summaries, monthly recaps, and optional sync to your own Google Drive.

## Category

Productivity

## Language

English (United States)

## Detailed description (plain text — CWS does not render Markdown)

Tasker automatically records how you spend your time in Chrome and turns it into a written record of your work: a daily log and a monthly recap you can actually hand to someone.

WHAT IT DOES
- Tracks time on your active tab automatically. There are no timers to start or stop, and nothing to remember.
- Sorts your browsing into categories as you go: Development, Research, Productivity, Communication, Design, and more.
- Gives you a daily focus score, and lets you log accomplishments the moment they happen so wins are not forgotten by Friday.
- Writes a clean daily log and a monthly recap report in Markdown, which you can copy, download, or keep forever.
- Optionally saves those reports to a folder in your own Google Drive.
- Pauses on its own when you step away from the computer, so idle time is never counted as work.

WHY INSTALL IT
Most people rebuild their week from memory. Timesheets, client invoices, status updates, performance reviews — all written days later, from a vague recollection of what happened. Tasker keeps that record for you while you work. When someone asks what you got done last month, you have an answer instead of a guess.

PRIVATE BY DESIGN
Your browsing history stays on your device. Every site you visit, every page title, and every second tracked is stored in your browser's local storage. There is no Tasker account, no login, and no analytics.

Two things leave your machine, both under your control. First, if you turn on Google Drive sync, your own reports are saved to a folder in your own Google Drive using Google's official sign-in - Tasker requests the minimum Drive permission available, so it can only see files it created and never the rest of your Drive. Second, if you leave AI monthly summaries switched on, Tasker sends category totals only - the month, your total hours, active days, and time per category - to write the narrative. No URLs, page titles, domains or notes are ever sent, and switching it off keeps recaps fully offline.

You stay in control: exclude any site from tracking with one click (banking, email, health), pause tracking whenever you like, and export or permanently delete everything at any time.

GOOD TO KNOW
Tasker tracks activity inside Chrome only. It will not see time spent in desktop applications, video calls, or your code editor.

AI monthly summaries are included, with no API key or account to set up. A fair-use limit of 3 AI summaries per month applies. You can switch the feature off at any time in Settings, and recaps are then generated entirely on your device.

## Single-purpose statement (for the CWS "single purpose" field)

Tasker's single purpose is to track the user's own browsing activity time and turn it into daily and monthly activity summaries, which the user can optionally back up to their own Google Drive.

---

## Permission justifications (paste into the Privacy practices tab)

- **tabs** — Required to read the URL and title of the active tab so time spent can be attributed to the correct website. This is the core tracking function of the extension. Tab data is stored locally only.
- **storage** — Stores all activity logs, user notes, and settings locally via chrome.storage. This is the extension's only data store; there is no external server.
- **unlimitedStorage** — Activity logs accumulate over months of daily use and can exceed default storage quotas. Needed so long-term local history and monthly recaps are not truncated or lost.
- **idle** — Detects when the user is away from the keyboard so idle time is excluded and tracked time stays accurate. No idle data is transmitted.
- **identity** — Used solely to obtain a Google OAuth token (drive.file scope) when the user explicitly enables Google Drive sync, so their logs can be saved to their own Drive. Never used without user action.
- **alarms** — Schedules periodic background tasks: saving in-progress tracking data, finalizing daily summaries at day rollover, and running user-scheduled Drive syncs. MV3 service workers require alarms for reliable scheduling.

**Note:** Tasker declares **one narrow host permission**, for its own summary-service endpoint only. Earlier drafts declared `<all_urls>`; it was removed because the `tabs` permission alone supplies the tab URL and title needed for time attribution. The extension injects no content scripts and never reads or modifies page content, and it has no host access to any site the user visits. If a reviewer asks why a tracker needs no broad host access, this is the answer.

---

## Data-usage disclosure answers (Privacy practices tab)

Data collected — check exactly these:
- **Web history** (list of pages visited with titles and timestamps — stored locally on the user's device)
- **User activity** (time-on-site / interaction timing — stored locally on the user's device)

Certifications / attestations — answer:
- Data is NOT sold to third parties. ✔ certify
- Data is NOT used or transferred for purposes unrelated to the item's single purpose. ✔ certify
- Data is NOT used or transferred to determine creditworthiness or for lending purposes. ✔ certify
- Data is NOT used for personalized advertising.

Notes to support the answers: browsing history (URLs, page titles, per-site time) is stored in local browser storage and is never transmitted. Two transfers exist, both optional and user-controlled: (1) upload of the user's own reports to the user's own Google Drive under the `drive.file` scope, and (2) aggregate category totals only — month, total seconds, active-day count, and seconds per category — sent to our summary service to generate the AI monthly narrative. Transfer (2) contains no URLs, page titles, domains, notes or identifiers beyond a random per-install string used solely for rate limiting, and it can be disabled in Settings.

Note on "host permission": the extension declares one narrow host permission for its own summary API endpoint. It declares no broad host access and injects no content scripts.

## Privacy policy URL — LIVE

Paste this into the "Privacy policy" field in the Privacy practices tab:

```
https://tasker-landing-liard.vercel.app/privacy-policy.html
```

A privacy policy URL is mandatory because this extension declares collection of Web history / User activity.

## Homepage URL — LIVE

Paste this into the "Homepage URL" field in the Store listing tab:

```
https://tasker-landing-liard.vercel.app/
```

Both pages are hosted on Vercel (project `tasker-landing`, team `emperorda8s-projects`), deployed from `index.html` / `privacy-policy.html` in this repo. To update them, edit those files and redeploy with `vercel deploy --prod` from a directory containing the two files.

The old GitHub Pages URLs (`https://emperorda8.github.io/tasker-extension/…`) are still live. Keep them until the Chrome Web Store listing fields above have been switched to the Vercel URLs, then they can be retired.

**After the extension is published**, replace the placeholder `href="#"` on the "Add to Chrome" buttons in `index.html` with the real Chrome Web Store listing URL.
