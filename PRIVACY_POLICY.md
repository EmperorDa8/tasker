# Privacy Policy — Tasker: Activity Tracker & Google Drive Recap

**Effective date:** August 8, 2026
**Last updated:** August 30, 2026

Tasker ("the extension", "we") is a Chrome browser extension that helps you track your own browsing activity, summarize daily accomplishments, and optionally back up reports to your personal Google Drive. This policy explains what data Tasker handles, where it is stored, and the choices you have.

**The short version: Tasker is local-first. Your browsing data never leaves your device unless you explicitly sync it to your own Google Drive or enable the optional AI summary feature.**

---

## 1. Data Tasker Collects

To provide its single purpose — personal activity tracking and productivity recaps — Tasker records the following **on your device only**:

- **Web history / activity data**: the domain, page title, URL, activity category (e.g. Development, Research), and the time you spend on active browser tabs.
- **User-provided content**: accomplishment notes, milestones, and journal entries you type into the extension.
- **Settings**: your preferences, such as the Google Drive folder name, report format, sync frequency, excluded-domain list, whether AI summaries are enabled, whether the work profile is enabled, and (if you provide one) a custom Google OAuth Client ID.
- **Derived work profile (optional, on-device).** From the activity already stored above, Tasker computes an inference about which kind of work your browsing resembles, together with the supporting evidence (which tools, how much time, over how many days). This is derived on your device, stored with your settings, shown only to you, and **never transmitted**. It can be switched off entirely, or replaced with an answer you set yourself, in Settings.

Tasker does **not** collect or handle: personally identifiable information beyond your Google account authorization, passwords or other credentials, keystrokes, page contents, form inputs, or mouse activity.

**About page titles.** Tasker does not seek out health or financial information, but it does record the title of the page in your active tab, and a title can contain such things — an account balance, a clinic name. Two protections apply. First, on sites recognised as sensitive (banks, brokerages, crypto exchanges, mail, health and tax providers) Tasker records only the domain and deliberately discards the title. Second, any site on your excluded list is not recorded at all. That recognition list is best-effort and cannot cover every provider, so **if a site matters to you, add it to the excluded list** — that is the guarantee. Either way this information stays on your device: it is never sent to our summary service, which receives category totals only.

## 2. Where Your Data Is Stored

All tracked activity, notes, and reports are stored **locally in your browser** using `chrome.storage.local`. Your browsing history — the sites you visit, page titles, and time per site — never leaves your device. There is no account, no login, and no analytics.

Tasker operates one small service, used only to write the optional AI monthly summary described in section 3. It receives category totals only, never your browsing history, and only when that feature is switched on.

## 3. When Data Leaves Your Device

Data leaves your device **only** in these two cases, both fully under your control:

1. **Google Drive sync (optional).** When you click Sync (or enable automatic sync), Tasker uploads your daily log and monthly recap files (PDF documents by default, or Markdown if you choose) to a folder in **your own Google Drive account**, authorized through Google's official OAuth 2.0 sign-in (`chrome.identity`). The files are visible only to you under your Google account. Tasker requests the minimum Drive scope needed to create and update its own files. You can revoke this access at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). These reports are generated on your device; if the work profile is switched on, the report includes it, labelled as an inference.
2. **AI monthly summaries (optional, switchable off).** When you open a monthly recap, Tasker asks our summary service to write a short narrative for that month. Only aggregate totals are sent: the month, your total tracked seconds, the number of active days, and seconds per category (e.g. "Development: 58 hours"). **No URLs, page titles, domains, notes, milestones or work profile are ever sent.** Your browsing history cannot be reconstructed from this data. A random identifier generated on your device accompanies the request purely to apply a fair-use limit; it is tied to no account and nothing identifying. The service forwards the totals to Google's Gemini API, returns the text, and does not retain the request. Turn this off in Settings and monthly recaps are generated entirely on your device.

Google's handling of data in both cases is governed by the [Google Privacy Policy](https://policies.google.com/privacy).

## 4. What We Never Do

- We do **not** sell, rent, or trade your data.
- We do **not** transfer your data to third parties (there is no server to transfer it from).
- We do **not** use your data for advertising, ad targeting, marketing profiling, or creditworthiness/lending purposes.
- We do **not** share, sell or transmit the work profile described in section 1. It is computed on your device, shown only to you, and leaves your device only inside a report you choose to sync to your own Google Drive.
- We do **not** use your data for any purpose unrelated to the extension's single purpose of personal activity tracking.

## 5. Your Controls

- **Pause tracking** at any time with one click from the popup.
- **Exclude sensitive sites** (banking, email, health, password managers) via the excluded-domains list and one-click privacy presets in Settings. Excluded sites are never recorded.
- **Choose your report format** — PDF or Markdown — in Settings.
- **Switch off or override the work profile** in Settings. Switching it off stops it being computed at all; overriding it replaces the inference with your own answer everywhere it appears.
- **Export** your full history as JSON at any time.
- **Delete everything**: "Clear Local History" in Settings permanently erases all locally stored data. Uninstalling the extension also removes all local data. Files already synced to your Google Drive remain in your Drive under your control — you can delete them there.

## 6. Permissions Explained

| Permission | Why Tasker needs it |
|---|---|
| `tabs` | To read the domain and title of the active tab so time can be attributed to the right site and category. Page contents are never read, and Tasker has no host access to the sites you visit. |
| `storage`, `unlimitedStorage` | To save your activity log, notes, and settings locally on your device. |
| `idle` | To pause the timer when you step away from the computer, keeping stats honest. |
| `identity` | To sign in to your own Google account for Drive sync, via Google's official OAuth flow. |
| `alarms` | To keep the timer accurate. Chrome shuts a background extension down when idle, so Tasker sets a repeating alarm to wake up and record the time you have spent, roughly twice a minute. The same mechanism schedules optional automatic Drive backups. |
| `tasker-extension.onrender.com` (host access) | Host access to Tasker's own summary service, and to no other site. Used only when AI monthly summaries are switched on, and it receives category totals only — never a URL, page title or note. With the feature off, Tasker contacts nothing. |

## 7. Children's Privacy

Tasker is not directed at children under 13 and does not knowingly collect information from them.

## 8. Changes to This Policy

If we change this policy, we will update the "Last updated" date above and, for material changes, note it in the extension's update notes. Continued use after a change constitutes acceptance.

## 9. Contact

Questions or concerns about privacy? Contact the developer at **uabdul88@gmail.com**.
