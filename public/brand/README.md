# Qwickword brand assets

Source files the maintainer provided 2026-07-25 (originally `brandassets.zip` in the
repo root — extracted and organized here; the zip itself was removed once
these were in place).

## Palette (sampled from the source files)

- Background: `#292929`
- Accent (wordmark, icon): `#3DFEF1`
- Secondary text (tagline): `#D9D9D9`

## Tagline

"This meeting could have been a Qwickword."

## Files

- `wordmark-color.svg` / `.png` — the "qwickword.com" cursive wordmark +
  tagline, transparent background.
- `wordmark-color-on-dark.svg` / `.png` — same, on the `#292929` background.
- `wordmark-black.svg` / `.png`, `wordmark-white.svg` / `.png` — single-color
  variants for light/dark contexts.
- `icon-32.png`, `icon-180.png`, `icon-196.png` — the standalone cursive "Q"
  mark at standard favicon/touch-icon sizes (browser favicon, Apple touch
  icon, Android/Chrome icon).
- `social-card-square.png` — 1000x1000 wordmark + tagline on the dark
  background; sized for Twitter's "summary" card format.

## What's already wired up (2026-07-25)

- `src/app/icon.png`, `apple-icon.png`, `favicon.ico` — generated from
  `icon-196.png` / `icon-180.png` above.
- `src/app/opengraph-image.png` — a 1200x630 composition of
  `wordmark-color-on-dark.png` centered on the `#292929` background, used for
  link previews (Slack, iMessage, Twitter/X, etc.) via Next.js's
  file-convention metadata.

## What's NOT done yet -- an open decision, not an oversight

The homepage's actual visual identity (the indigo/violet ambient glow, the
serif Playfair Display "Q" watermark, the current color scheme) predates this
brand kit and was built through several rounds of the maintainer's own direction --
see `src/components/home-content.tsx`'s comments for that history. This new
kit's style (cursive/bouncy wordmark, cyan accent) is a different direction,
not a strict superset of the current look. Rolling it into the homepage
itself (replacing the watermark, the accent color, or both) is a deliberate
design decision, not something to auto-apply -- see ASKS.md and the
2026-07-25 chat log for the options laid out.
