# Tasker — launch / investor video

Remotion source for the 62-second product video. 1920×1080, 30fps, 1860 frames.

```bash
npm install
npm start              # Remotion Studio — scrub, edit, preview live
npm run build          # renders out/tasker-launch.mp4
npm run still          # renders out/poster.png (frame 330)
```

`out/` is gitignored — the MP4 is a build artifact, not source.

## Every claim in this video is verifiable

This is an investor-facing asset, so it deliberately contains **no traction metrics, no
user counts, no revenue, no testimonials and no market-size figures**, because none of
those are measured yet. Inventing them in a deck or a video is misrepresentation, and it
is the kind that gets checked during diligence.

What is on screen instead is the product and its architecture. Each line traces to a
source in this repo:

| On screen | Source |
| --- | --- |
| "Time on the active tab, attributed to its domain and page title" | `background/tracker.js`, README Features |
| "Sorted automatically across nine activity categories" | README Features — the nine are named there |
| "Idle-aware: the timer pauses when you step away" | `chrome.idle`, manifest permission, README |
| "Every day becomes a clean Markdown log" | `background/summarizer.js`, PRIVACY_POLICY.md §3 |
| "drive.file scope … cannot read the rest of your Drive" | `manifest.json` oauth2 scopes, PRIVACY_POLICY.md §3.1 |
| "Aggregate category totals — never URLs, page titles or notes" | PRIVACY_POLICY.md §3.2, `background/summarizer.js` |
| "chrome.storage.local. No account, no login, no analytics" | PRIVACY_POLICY.md §2 |
| "Free · No sign-up · No credit card" | No account system exists in the codebase |
| "Manifest V3 · MIT licensed · v1.1.0" | `manifest.json`, `LICENSE` |
| "Chrome only … desktop apps, calls and editor time are out of frame" | README Limitations |

The product screenshots in `public/shots/` are the real store screenshots from
`screenshots/final/` — not mockups, not redraws. The dashboard figures visible inside them
are the sample data those screenshots were captured with.

**When the version ships past v1.1.0, update the chip in `src/scenes.tsx` (`Status`).**
A stale version number is the kind of small inaccuracy that costs credibility in a room.

## If you later have real traction

Add it as its own scene between `Status` and `Close` — never as a caption bolted onto an
existing claim. Use absolute numbers you can evidence from the Chrome Web Store developer
dashboard (weekly active users, install count, rating). Do not use percentages without the
base, which is the oldest trick in a bad deck and reads as one.

## Structure

- `src/Video.tsx` — the timeline. Scene order and durations live here and nowhere else.
- `src/scenes.tsx` — all nine scenes plus their copy.
- `src/components/` — `Bg` (gradient/grain), `Type` (Kicker/Headline/Sub/Chip),
  `Device` (browser frame), `Scene` (edge fades that produce the cross-dissolves).
- `src/theme.ts` — palette lifted from the product's own `:root` tokens.
- `src/fonts.tsx` — loads the real brand fonts from `public/fonts` so renders are offline
  and deterministic.

## Editing notes

- Scenes butt against each other and cross-dissolve via their own edge fades. To retime,
  change `TIMELINE` in `src/Video.tsx` and keep `TOTAL_FRAMES` equal to the last
  `from + dur`.
- Type entrances are word-by-word springs (`Headline`). Delays are in frames at 30fps.
- The screenshot in the split scenes intentionally bleeds off the right edge. To contain
  it, drop `width` on the `Device` in `SplitScene`.
