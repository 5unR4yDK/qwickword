# Qwickword brand assets

Source files for the wordmark and icon, organized from the original brand
kit the maintainer commissioned (2026-07-25).

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
  background, sized for Twitter's "summary" card format.

## What's wired up already

- `src/app/icon.png`, `apple-icon.png`, `favicon.ico` — generated from a
  separate, later favicon (cyan rounded square, black lowercase "q"), not
  from `icon-196.png` / `icon-180.png` above. Those two files are kept here
  as the earlier cursive-wordmark icon variant, superseded for the actual
  favicon but left in place in case they're useful elsewhere.
- `src/app/opengraph-image.png` — a 1200x630 composition of
  `wordmark-color-on-dark.png` centered on the `#292929` background, used for
  link previews (Slack, iMessage, Twitter/X, etc.) via Next.js's
  file-convention metadata.

## Homepage redesign: still open

The homepage's current visual identity (the indigo/violet ambient glow, the
serif Playfair Display "Q" watermark) predates this kit and is a different
direction — cursive and bouncy versus elegant and moody. Rolling this
brand's look into the homepage itself, whether that means the watermark, the
accent color, or both, is a deliberate design call rather than an automatic
follow-on from adding the favicon and social card. See `ASKS.md` for the
options.
