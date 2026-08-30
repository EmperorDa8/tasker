# Tasker — Chrome Web Store Publishing Checklist

Step-by-step from this repo to a live listing.

## 0. One-time developer account
- [ ] Register at https://chrome.google.com/webstore/devconsole with your Google account and pay the one-time **$5 developer registration fee**.

## 1. Prepare the package (done by this repo)
- [ ] `manifest.json` audited (MV3, name/description within limits, icons valid PNGs at 16/48/128).
- [ ] Upload zip built: `tasker-v1.1.0.zip` at repo root, with `manifest.json` at the zip root (contents zipped, not the parent folder).
- [ ] IMPORTANT: the `oauth2.client_id` in `manifest.json` is a **placeholder** (`REPLACE_WITH_YOUR_CLIENT_ID.apps.googleusercontent.com`). Drive sync will not work until you replace it (see step 3) and re-zip/re-upload.

## 2. First upload — get your stable extension ID
The OAuth client for a Chrome extension is bound to the extension's **item ID**, so you need a stable ID before you can create the client. Two options:

**Option A (recommended): upload first**
1. In the dev console, click "New item" and upload `tasker-v1.1.0.zip` as a **draft** (you do not need to submit for review yet).
2. Note the 32-character item ID the dashboard assigns. This ID is now permanent for this listing.

**Option B: pin the ID locally with a "key"**
1. Load the unpacked extension, or upload once, and obtain the public key (`chrome://extensions` → pack, or from the dashboard).
2. Add that `"key"` field to `manifest.json` so the local unpacked ID matches the store ID — useful so `getAuthToken` works while developing before publishing.

## 3. Google Cloud Console — OAuth client + Drive API
1. Create (or pick) a project at https://console.cloud.google.com.
2. **Enable the Google Drive API**: APIs & Services → Library → "Google Drive API" → Enable.
3. Configure the **OAuth consent screen**: External, app name "Tasker", your support email, and add the scope `https://www.googleapis.com/auth/drive.file`. While unverified, keep it in Testing mode with your account as a test user, or expect the "unverified app" warning.
4. APIs & Services → Credentials → **Create credentials → OAuth client ID → Application type: Chrome Extension** → enter the item ID from step 2.
5. Copy the generated client ID (`xxxxx.apps.googleusercontent.com`) into `manifest.json` → `oauth2.client_id`, replacing the placeholder.
6. Rebuild the zip and upload the new package to the dashboard.

Note: the manifest `oauth2` block + `chrome.identity.getAuthToken` is the only auth path. The earlier user-supplied client ID field and its `launchWebAuthFlow` fallback were removed — end users should never need to configure OAuth, and that fallback used the deprecated implicit flow.

## 4. Dashboard — store listing tab
- [ ] Paste name, short description, detailed description, and category (Productivity) from `STORE_LISTING.md`.
- [ ] **Screenshots (required): at least 1, up to 5, exactly 1280x800 or 640x400 PNG/JPEG.**
      Run `python scripts/build_screenshots.py` - it captures the real popup, dashboard
      and settings pages with headless Chrome and writes five 1280x800 PNGs to
      `screenshots/final/`, then checks their dimensions. Re-run it after any UI change;
      the old hand-built mockups drifted from the product and had to be thrown away.
- [ ] Optional promo images: small tile 440x280; marquee 1400x560.
- [ ] Icon 128x128 is taken from the package automatically.

## 5. Dashboard — privacy tab
- [ ] Single-purpose statement (from `STORE_LISTING.md`).
- [ ] One justification per permission: tabs, storage, unlimitedStorage, idle, identity, alarms (all pre-written in `STORE_LISTING.md`), plus the host-permission justification for the summary-service origin.
- [ ] Data-usage disclosures: check **Web history** and **User activity**; certify not sold / not transferred for unrelated purposes / not for creditworthiness; not used for ads.
- [x] **Privacy policy URL** — LIVE at `https://tasker-landing-liard.vercel.app/privacy-policy.html`. Mandatory field; paste it in.
- [x] **Homepage URL** — LIVE at `https://tasker-landing-liard.vercel.app/` (Store listing tab).

## 6. Submit for review — expectations
- The `<all_urls>` host permission was **removed** (the `tabs` permission alone covers time attribution), which avoids the in-depth review that broad host access triggers. Reviews are typically faster as a result, but `tabs` + a Web-history disclosure can still draw scrutiny — plan for days, not hours.
- Rejection risk mitigations already in place: clear single purpose, per-permission justifications, privacy policy, local-first data handling. Do not add remote code (CWS forbids remotely hosted code in MV3).
- If rejected, the email cites the policy section; fix and resubmit — the item keeps its ID.

## 7. Post-publish — OAuth verification
- The `drive.file` scope is **not** classified restricted (it is the recommended per-file scope), but an External consent screen still requires **brand verification** by Google once you leave Testing mode; until verified, users see an "unverified app" interstitial (capped at 100 users for sensitive flows).
- Submit the consent screen for verification in Cloud Console (needs the published extension URL, the hosted privacy policy URL, and possibly a short scope-justification). Verification is separate from, and can be done after, CWS review.
- After changing `client_id` or scopes, bump `version` in `manifest.json` and upload a new zip.

## Quick blocker list (manual actions only you can do)
1. Pay the $5 fee / register the developer account.
2. Upload the draft to get the item ID, then replace placeholder `oauth2.client_id` with the real one (step 3) and re-zip.
3. Take 1280x800 (or 640x400) screenshots.
4. ~~Host the privacy policy~~ — done, live on Vercel (`tasker-landing`).
