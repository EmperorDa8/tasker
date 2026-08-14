# Reddit launch kit — Tasker

Goal: real users + real feedback, without tripping Reddit's spam enforcement.

**Single destination: the landing page.** Every post drives to
`https://tasker-landing-liard.vercel.app/` — it carries the Add to Chrome button, the
privacy pitch, and the full policy in one place. Do not link the store or the repo as the
primary CTA; the landing page is one click from the store listing anyway.

## Compliance check against the Reddit Rules

Mapped against the eight Reddit Rules as published at
https://redditinc.com/policies/reddit-rules. The preamble matters as much as the rules:
abide by *"not just the letter of these rules, but the spirit as well,"* and *"do not
interfere with those [communities] in which you are not a member."*

| Rule | Applies here? | How these posts comply |
| --- | --- | --- |
| 1. Remember the human | Low | No attacks, no targeting. Applies to your comment replies too — stay civil with critics |
| 2. Abide by community rules. Participate authentically in communities where you have a personal interest, and do not spam or engage in disruptive behaviors (including content manipulation) | **Primary** | Governs everything here. Three obligations: (a) follow each sub's own rules, including flair and any promo-thread restriction; (b) post only where you have genuine personal interest — see below; (c) no spam or content manipulation, i.e. no multi-sub blasting, no vote manipulation, no alts |
| 3. Respect the privacy of others | **Product-specific risk** | Never screenshot a live dashboard — it shows real domains and page titles. Use `screenshots/final/`. A capture naming a client, an employer's internal tooling, or another person exposes their information |
| 4. No sexual, abusive, or suggestive content involving minors | No | N/A |
| 5. Be authentic. Do not intentionally mislead others or impersonate an individual or entity deceptively | Yes | Two obligations, not one. **Impersonation:** post as yourself, the developer; never as a satisfied "user" from another account. **Misleading:** every factual claim must hold — hence the Gemini caveat in every version, and no invented install counts or traction numbers |
| 6. Label content properly (graphic, sexually-explicit, or offensive content) | No | N/A. Subreddit flair requirements are a community rule and fall under Rule 2, not here |
| 7. Keep it legal | Yes | Free product, no transaction solicited |
| 8. Don't break the site | No | N/A |

### The "personal interest" test (Rule 2)

Rule 2 does not say "don't spam." It says *participate authentically in communities where
you have a personal interest.* Picking subs by where the target users are is audience
targeting, and it fails that test even when every individual post is honest.

So the sequence below is a candidate list, not a plan. Before posting to any sub, ask: **do
I read this community when I have nothing to promote?** If no, drop it. Three posts in
communities you actually belong to will outperform seven drive-by launches, and they carry
no enforcement risk.

This also reframes pre-launch commenting. The point is not to accumulate history so the
account looks legitimate to automod — that is gaming the letter of the rule. The point is
that you should already be a member of the communities you launch in.

### Enforcement exposure

Reddit lists content removal, temporary or permanent account suspension, restrictions on
accounts, and banning of communities. The realistic downside of getting this wrong is a
removed post and a shadow-banned domain — which would cost you the landing-page link across
all of Reddit, not just in one sub.

Note: Reddit's advertising policies are a separate ruleset that applies to paid promotion.
If you ever boost a post, re-check under those rules instead of these.

## Rules this kit is built around

1. **Subreddit rules beat sitewide guidance.** Read the sidebar and the rules page of every sub before posting. Some require flair, some confine promo to a weekly thread, some ban links outright.
2. **Disclose authorship in the post body.** Every draft here does.
3. **Never post the same text to multiple subs in one sitting.** That is the single most reliable way to get filtered as spam. One sub per day maximum, rewritten each time.
4. **No asking for upvotes, no alt accounts, no getting friends to vote.** Vote manipulation is one of the few things Reddit bans sitewide and permanently.
5. **Be an actual member.** Rule 2 requires participating authentically in communities where you have a personal interest. Post only in subs you already read. An account whose entire history is one product is both a spam signal to automod and a Rule 2 problem on its own.
6. **Answer every comment, including the hostile ones.** Comment volume is what keeps a post alive, and a graceful reply to a critic converts more people than the post does.

## The offer, stated the same way every time

Keep this consistent across every post and comment — it is the part that removes hesitation:

> It's live on the Chrome Web Store right now, ready to install. Free. No sign-up, no
> account, no credit card. Install it and it starts working.

## Subreddit sequence

Post in this order, roughly one every 3–5 days. Rewrite the post each time — do not copy-paste.

| Sub | Fit | Watch out for |
| --- | --- | --- |
| r/SideProject | Very high — built for this | Expects a story, not a pitch |
| r/chrome_extensions | Very high — exact audience | Small but converts well |
| r/productivity | Medium | Strict self-promo rules; check whether a weekly thread is required |
| r/privacy or r/privacytoolsIO | Medium-high | Brutal on privacy claims. Only post Variant B. Expect "where's the source?" — answer it in comments |
| r/opensource | High content fit, awkward funnel fit | This sub wants the repo linked, not a landing page. Either accept linking the repo here or skip the sub |
| r/webdev, r/coolgithubprojects | Medium | Frame as a build story. Same repo-versus-landing-page tension |
| r/selfhosted | Medium — only if you pitch `server/` | They care about the summary service being self-hostable |

Skip r/InternetIsBeautiful and the big general subs on launch. They punish product posts.

## Post A — main (r/SideProject, r/chrome_extensions)

**Title:** I kept guessing what I actually did each month, so I built a local-first Chrome time tracker that writes the recap for me

Every performance review and every invoice, I was rebuilding weeks from memory. I'd stare at a calendar and reconstruct a vague story of what happened. So I built the thing that keeps the record while I work.

**Tasker** tracks time on your active Chrome tab, sorts it into categories (Development, Research, Communication, etc.), and turns each day into a Markdown log and each month into a recap — total focus time, active days, category breakdown, milestones you logged as they happened.

It's live on the Chrome Web Store now, ready to install. **Free — no sign-up, no account, no credit card.** You install it and it starts working. Everything's here, including the install button and the full privacy policy: https://tasker-landing-liard.vercel.app/

**The privacy part, stated precisely**, because "private" gets thrown around loosely:

- Your history — domains, page titles, time per site — lives in `chrome.storage.local` and never leaves your machine. No account, no login, no analytics.
- Drive sync is optional and uses the narrow `drive.file` OAuth scope, so it can only touch files it created. It cannot read the rest of your Drive.
- **One thing does leave the device, if you opt in:** the AI monthly summary sends aggregate totals only — month, total seconds, active days, seconds per category ("Development: 58 hours"). No URLs, titles, domains, or notes. Turn it off and recaps are generated entirely offline by a rule-based summariser. I'm calling that out because a time tracker sees your whole day and you shouldn't have to take my word for it.

**Honest limitation:** it only sees inside Chrome. Time in your editor, on calls, or in desktop apps is invisible to it. If most of your work happens outside the browser this will undercount you badly.

**What I'd genuinely like feedback on:**

1. Is the focus score meaningful or is it a vanity metric? It's a 0–100 index from how time is distributed, and I'm not convinced the formula reflects a real day.
2. What breaks the categorisation for you? I want the domains it misfiles.
3. Would you actually use the Drive sync, or does "it writes files into my Drive" feel like more than you want an extension doing?

*Disclosure: I built it. Happy to answer anything about the implementation.*

## Post B — privacy-first audience (r/privacy, r/privacytoolsIO)

**Title:** A time tracker sees your entire day, so I built mine local-first — here's exactly what does and doesn't leave the device

Lead with the threat model, not the features.

I wanted browser time tracking without handing my full browsing history to a SaaS dashboard. Every option I found wanted an account and a server. So I wrote one that keeps the data on the machine.

**What stays local:** every domain, page title, and duration, in `chrome.storage.local`. No account, no login, no telemetry, no analytics SDK. There is no server holding your history because there is no server. No sign-up and no card, because there's nothing to sign up to — it's free and it isn't a SaaS trial.

**What can leave, both opt-in:**

1. **Drive sync** — writes `Tasker_Daily_Log_YYYY-MM-DD.md` into a folder in *your* Drive, over `chrome.identity` OAuth with the `drive.file` scope. That scope is per-file: the extension can only see files it created, not your existing Drive.
2. **AI monthly summary** — posts aggregate category totals to a small proxy that holds the Gemini key, because an API key shipped inside a published extension is public the moment you publish. What's sent: month, total seconds, active days, seconds per category. What's never sent: URLs, page titles, domains, notes, milestones. A random device-side identifier rides along purely for rate limiting and is tied to no account. Switch it off and monthly recaps are generated offline.

**Other controls:** exclude any domain from tracking, pause tracking, export everything as JSON or Markdown, wipe all local data. `chrome.idle` pauses the timer when you step away.

Manifest V3, and the `<all_urls>` host permission was deliberately removed — `tabs` alone covers time attribution.

It's on the Chrome Web Store and ready to install. Full policy and the install button: https://tasker-landing-liard.vercel.app/

Tell me where the threat model is weak. Particularly interested in whether the proxy is the right call versus making people supply their own key.

*Disclosure: I'm the author.*

## Post C — build story (r/webdev, r/coolgithubprojects)

**Title:** Built a Chrome extension with zero dependencies and no build step — here's what that constraint cost me

Frame the engineering, not the product. Angles that earn comments:

- Shipping an extension where an embedded API key would be public on day one, and why `server/` exists as a consequence.
- Attributing time accurately with `chrome.idle` so away-from-keyboard time isn't counted as work.
- Dropping `<all_urls>` to avoid the in-depth Chrome Web Store review, and what that cost in functionality.
- MV3 service worker lifecycle versus a tracker that needs continuity.

Close with one line: it's live on the store, free, no sign-up — https://tasker-landing-liard.vercel.app/

## Post D — founder voice (r/SideProject, r/chrome_extensions, r/productivity)

The strongest single post in this kit. Use it as the launch post; keep Post A as the
alternate for a second sub.

**Title:** I couldn't answer "so what did you get done last month?" — so I built the thing that answers it. It's live, free, and I want you to break it.

Last review cycle I sat down to write my self-assessment and realised I had nothing. Not because the month was empty — because I'd spent it in forty tabs a day and remembered none of it. I reconstructed the whole thing from calendar invites and guesswork, and I know for a fact I undersold myself.

That's the entire origin story here. I wanted a record that writes itself while I work, so when someone asks, I have an answer instead of a vibe.

**What it does:** tracks time on your active Chrome tab, categorises it (Development, Research, Communication…), and turns each day into a Markdown log and each month into a recap — hours, active days, category split, and the milestones you jotted down as they happened.

It's live on the Chrome Web Store now, ready to install. **Free — no sign-up, no account, no credit card.** Install it and it starts working: https://tasker-landing-liard.vercel.app/

Two things I'd rather you hear from me than discover later:

- **It's local-first, genuinely.** Your history — domains, titles, time per site — stays in `chrome.storage.local`. No account, no analytics, no server holding it. The one exception is the optional AI monthly summary, which sends category totals only ("Development: 58 hours"), never URLs, titles, or notes. Turn it off and recaps are built on-device.
- **It only sees Chrome.** Your editor, your calls, your desktop apps are invisible to it. If your work lives outside the browser, this will undercount you and you'll hate it.

I'm one person and this is the version I could build alone, so what I actually need is people telling me where it's wrong:

1. Is the focus score real, or is it a vanity number? It's 0–100 based on how your time splits, and I keep going back and forth on whether it means anything.
2. Which sites does it misfile? The categoriser is opinionated and definitely wrong somewhere.
3. Would you turn on Drive sync, or does an extension writing files into your Drive feel like a step too far?

Install it, use it for a week, then come back and tell me it's broken. That's worth more to me than an install count.

*I'm the developer — ask me anything about how it works under the hood.*

### Why this one works

- The opening is a failure, not an announcement. "Excited to share" is the phrase that kills founder posts; a specific humiliating moment is the one that earns attention.
- The limitation is stated in the second person ("you'll hate it"). Disqualifying the wrong users up front buys credibility with the right ones, and stops the top comment being someone pointing out the gap.
- The three questions are arguable. "Is the focus score a vanity metric?" invites people to take a side, and comment volume is what keeps a post visible.
- The closing ask is for criticism, not installs. Counterintuitively it produces more installs, because it reads as someone building rather than selling.

**One thing to adapt per sub:** if a sub bans links in the body, move the landing-page URL into your own first comment and replace it with "link in the comments — mods, happy to remove if it breaks a rule."

## Links

- **Primary CTA, use this everywhere:** https://tasker-landing-liard.vercel.app/
- Store listing (the landing page's Add to Chrome button points here — don't post it directly): https://chromewebstore.google.com/detail/tasker-activity-tracker-g/nfdjclnanladapnhofbmnhclkhlndeak
- Source, for comment replies only: https://github.com/EmperorDa8/tasker

In link-restricted subs, put the landing page in your own first comment instead of the body.

## Engagement playbook

**First comment, post it yourself immediately after publishing** — seeds the thread and holds the link:

> Keeping the link out of the post body: https://tasker-landing-liard.vercel.app/ — install button, screenshots, and the full privacy policy are all there. It's live on the Chrome Web Store, free, no sign-up or card needed. Genuinely after criticism here, not installs, so tell me what's wrong with it.

**Prepared answers.**

*"How is this different from RescueTime / Toggl / Clockify?"*
> RescueTime is more capable and tracks your whole OS — if you want the full picture, use it. Two differences: this is browser-only, and it has no server holding your history. Everything sits in local browser storage. It's the local-first, no-account option, not the more-featured one. Also free with no sign-up, so trying it costs you a click.

*"Is it actually free? What's the catch / when does the paywall land?"*
> Actually free. No account system exists, so there's nothing to upsell you into and no card on file anywhere. The only thing that costs me money is the optional AI summary service, which is why it's a small proxy and rate-limited rather than unlimited.

*"Why should I trust you with my browsing history?"*
> You shouldn't, which is why there's nowhere for me to put it. There's no account system and no backend holding history. The privacy policy on the site spells out exactly what the two optional features transmit. If you want to verify rather than trust, the source is public — ask and I'll link it.

*"Where's the source?"*
> Public and MIT: https://github.com/EmperorDa8/tasker — no build step, plain ES modules, so the code you read is the code that runs. Load it unpacked if you'd rather not use the store build.

*"So it does send data to Gemini."*
> Only if you leave the monthly summary on, and only category totals — "Development: 58 hours" — never a URL, title, or note. Off, and recaps are built entirely on-device.

*"Chrome-only? What about Firefox?"*
> Chrome-only today. Worth doing if there's demand — say so here and I'll gauge it.

**Cadence:** stay in the thread for the first 3 hours, then check back for 48. Most feedback arrives after hour 6.

## Do not

- Post to multiple subs the same day.
- Screenshot your own live dashboard. It contains real domains and page titles — yours, and potentially a client's or employer's. Use `screenshots/final/`.
- Ask for upvotes, anywhere, in any wording.
- Use a second account to comment or vote on your own post.
- Delete and repost when a post underperforms — mods notice.
- Argue with critics. Concede the point, log the issue, move on. The audience is reading your replies, not the criticism.
- Claim "your data never leaves your device" without the Gemini caveat. It's the one claim that would be false, and someone will read the source and find it.
