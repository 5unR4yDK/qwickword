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

- `wordmark-color.svg` / `.png`: the "qwickword.com" cursive wordmark +
  tagline, transparent background.
- `wordmark-color-on-dark.svg` / `.png`: same, on the `#292929` background.
- `wordmark-black.svg` / `.png`, `wordmark-white.svg` / `.png`: single-color
  variants for light/dark contexts.
- `wordmark-only.svg` / `wordmark-only-black.svg`: the script alone, without
  the tagline. What the site actually renders on every page.
- `social-card-square.png`: 1000x1000 wordmark + tagline on the dark
  background, sized for Twitter's "summary" card format.
- `qmark.png`: the superseded favicon mark, a cyan rounded square with a
  black lowercase "q", transparent corners. It stopped being the source
  for the favicon slots and `README.md` header on 26 August 2026. The native
  mobile app still uses this mark as its app icon.
- `colormark.png`: the two-tile colormark, blue and yellow offset
  diagonally, on transparency. The founder's artwork, from
  `Brand & Comms Library/Branding & Logos` in the PKP Shared Folder. This
  is the mark the desktop app and browser tab wear.

## What's wired up already

- `src/app/icon.png`, `apple-icon.png`, `favicon.ico`: the colormark on the
  `#0B1D33` navy, redrawn 26 August 2026. They replace the former
  `qmark.png`-derived cyan `q`, so the browser tab and desktop app now use
  the same mark.

  The mark is redrawn from measured geometry rather than resampled from
  `colormark.png`, so the edges are correct at every size. On a 460 x 558
  grid: blue tile x 230-460 y 0-328, yellow tile x 0-230 y 328-558, corner
  radius 70, and each tile carries one square corner where the two meet.
  The colours are `#80AFF0` and `#F7DF2C`.

  | Slot | What it is | Geometry |
  | --- | --- | --- |
  | `favicon.ico` | browser tab, bookmark, Windows shortcut | 16, 32, 48, 64, 128, 256, no alpha |
  | `icon.png` | `<link rel="icon">`, and the Android/PWA tile | 512x512, no alpha |
  | `apple-icon.png` | iOS home screen from Safari; iOS applies its own mask | 180x180, no alpha, no corner rounding |

  The mark is kept on its navy rather than on transparency so the tab icon
  is legible in light and dark browser chrome alike. The 16 and 32 entries
  are optically rescaled - the mark fills 94% of the tile instead of the
  stock 87% - because at that size the stock margin costs more than it
  buys: the yellow tile drops below two pixels of solid colour and the pair
  reads as one smudge.

  These three files are generated in the `qwickword-platform` repository and
  copied here. That repository carries the full provenance, in
  `apps/mobile/src/shared/PUBLISHED_ASSET_PROVENANCE.md`.
- The iPhone app uses the same two marks: `qmark.png` as its app icon, and
  `wordmark-color.png` cropped to the script alone. See
  `QwickwordMobile/scripts/prepare-brand.mjs`.

## Removed

`icon-32.png`, `icon-180.png`, `icon-196.png` — a standalone cursive "Q"
monogram, generated rather than commissioned, and not part of this identity.
Deleted 31 July 2026. Nothing referenced them. The mark is the `q` in
`qmark.png`; there is no separate monogram.
- `src/app/opengraph-image.png`: a 1200x630 composition of
  `wordmark-color-on-dark.png` centered on the `#292929` background, used for
  link previews (Slack, iMessage, Twitter/X, etc.) via Next.js's
  file-convention metadata. Still the cursive wordmark, not `qmark.png`;
  see the open question below.

## Homepage redesign: still open

The homepage's current visual identity (the indigo/violet ambient glow, the
serif Playfair Display "Q" watermark) and the cursive wordmark kit are still
two different visual treatments, and the favicon is now a third - the
colormark, shared with the desktop app.

That was the point of the favicon change: a browser tab and a desktop taskbar
should not show two different products. It does not settle the rest.
`src/app/opengraph-image.png` is still the cursive wordmark on `#292929`, so a
link preview and a tab still disagree. Rolling one look across the link-preview
image and the homepage itself is a deliberate design call rather than an
automatic follow-on from the favicon.
