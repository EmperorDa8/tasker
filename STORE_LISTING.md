# Chrome Web Store Listing — Tasker

Ready-to-paste content for the Chrome Web Store Developer Dashboard.

---

## Extension name

Tasker - Activity Tracker & Google Drive Recap

## Short description (max 132 characters — this one is 110)

Local-first activity tracker: automatic time tracking, branded PDF reports, and sync to your own Google Drive.

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
- Turns each day into a branded PDF report - cover page, focus score, category charts, page numbers - that you can download or send as it is. Prefer plain text? Markdown is one setting away.
- Writes a monthly recap report of your accomplishments, category mix, and the repositories or tickets your time went into.
- Optionally saves those reports to a folder in your own Google Drive, filed into Daily Logs and Monthly Recaps subfolders.
- Tells you what kind of work your week looks like, based on the tools you actually spend time in - and shows you the evidence behind it.
- Pauses on its own when you step away from the computer, so idle time is never counted as work.

ABOUT THE WORK PROFILE
Tasker can look at the tools in your browsing and tell you which kind of work the pattern resembles, across 54 roles including recent ones such as AI engineering, agent work, evaluation and MLOps.

It is built to be careful about it. Every finding comes with the evidence it rests on: which tools, how many hours, across how many days. When there is not enough to go on, it says "not enough evidence yet" and tells you what is missing, rather than guessing. When two profiles score too closely, it shows you the shortlist instead of picking one. Where the job market runs the same work under several names, it reports the family rather than pretending it can tell them apart.

The whole thing is computed on your device from data already stored there. It is never transmitted anywhere. You can switch it off entirely, or set your own role, in which case your answer replaces it everywhere and is labelled as yours rather than detected.

WHY INSTALL IT
Most people rebuild their week from memory. Timesheets, client invoices, status updates, performance reviews — all written days later, from a vague recollection of what happened. Tasker keeps that record for you while you work. When someone asks what you got done last month, you have an answer instead of a guess.

PRIVATE BY DESIGN
Your browsing history stays on your device. Every site you visit, every page title, and every second tracked is stored in your browser's local storage. There is no Tasker account, no login, and no analytics. Your PDF reports are generated on your device too, and your work profile is worked out there and never sent anywhere at all.

Two things leave your machine, both under your control. First, if you turn on Google Drive sync, your own reports are saved to a folder in your own Google Drive using Google's official sign-in - Tasker requests the minimum Drive permission available, so it can only see files it created and never the rest of your Drive. Second, if you leave AI monthly summaries switched on, Tasker sends category totals only - the month, your total hours, active days, and time per category - to write the narrative. No URLs, page titles, domains or notes are ever sent, and switching it off keeps recaps fully offline.

You stay in control: exclude any site from tracking with one click (banking, email, health), pause tracking whenever you like, and export or permanently delete everything at any time.

GOOD TO KNOW
Tasker tracks activity inside Chrome only. It will not see time spent in desktop applications, video calls, or your code editor. Every report says so on the page, so a log you hand to someone else is never mistaken for a full working day.

The work profile is an inference from your browsing, not a verified fact about you, and every screen that shows it says so.

AI monthly summaries are included, with no API key or account to set up. A fair-use limit of 3 AI summaries per month applies. You can switch the feature off at any time in Settings, and recaps are then generated entirely on your device.

## Single-purpose statement (for the CWS "single purpose" field)

Tasker's single purpose is to track the user's own browsing activity time and turn it into daily and monthly activity summaries, which the user can optionally back up to their own Google Drive.

Everything the extension does serves that purpose and uses only the activity data it already recorded locally. The PDF reports are the same summaries in a document format. The work profile is a summary of the same locally-stored activity, computed on the device and never transmitted; it adds no permission, no data collection and no network request.

---

## Permission justifications (paste into the Privacy practices tab)

- **tabs** — Required to read the URL and title of the active tab so time spent can be attributed to the correct website. This is the core tracking function of the extension. Tab data is stored locally only.
- **storage** — Stores all activity logs, user notes, and settings locally via chrome.storage. This is the extension's only data store; there is no external server.
- **unlimitedStorage** — Activity logs accumulate over months of daily use and can exceed default storage quotas. Needed so long-term local history and monthly recaps are not truncated or lost.
- **idle** — Detects when the user is away from the keyboard so idle time is excluded and tracked time stays accurate. No idle data is transmitted.
- **identity** — Used solely to obtain a Google OAuth token (drive.file scope) when the user explicitly enables Google Drive sync, so their logs can be saved to their own Drive. Never used without user action.
- **alarms** — Keeps the timer accurate. Chrome suspends an MV3 service worker after a few seconds of inactivity, so Tasker registers a repeating alarm (every 30 seconds) that wakes the worker to record elapsed time on the active tab; without it, time spent reading a single page goes uncounted. A second, six-hourly alarm runs the optional Drive sync and prunes history past the retention window.

**Note:** Version 1.3.0 adds branded PDF reports and the on-device work profile, and requests **no new permissions** for either. The PDF is generated locally from data already stored under `storage`, and the work profile is computed locally from that same data.

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

The inferred work profile is deliberately excluded from transfer (2) and from every other network request. It is derived on the device from locally-stored activity, is stored only in local settings, and appears outside the device only if the user chooses to sync a report containing it to their own Google Drive.

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

The "Add to Chrome" buttons in `index.html` already point at the live listing
(`https://chromewebstore.google.com/detail/tasker-activity-tracker-g/nfdjclnanladapnhofbmnhclkhlndeak`).

---

## What changed in 1.3.0 — for the "What's new" field

Branded PDF reports. Daily logs and monthly recaps are now finished documents with a cover page, focus score, category charts and page numbers. Markdown is still available in Settings.

A work profile, built on evidence. Tasker reads the tools you spend time in and tells you what kind of work that resembles, with the evidence behind it. It says "not enough evidence yet" rather than guessing, and you can override it.

A rebuilt interface. New design system across the popup, dashboard and settings, with dark mode.

Drive reports are now filed into Daily Logs and Monthly Recaps subfolders.
