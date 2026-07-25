// Camera-off fallback avatars — see call-video-grid.tsx. Uses DiceBear's free
// HTTP API (https://www.dicebear.com/how-to-use/http-api/): a plain URL that
// returns a deterministic SVG for a given seed, no account/API key/rate-limit
// concern at this app's traffic level, and no image to generate or store
// ourselves — the browser just requests the URL like any other image.
//
// Seeded on the participant's own Daily session ID (not the room's slug), so
// each person in a call gets their own distinct, consistent-for-that-call
// avatar rather than both participants showing the same one. Style is
// `identicon` — a plain geometric pixel-grid pattern, chosen over DiceBear's
// more illustrated styles (e.g. "bottts", "personas") as the better fit
// against this app's minimalist cyan/black brand.
const DICEBEAR_BASE = "https://api.dicebear.com/10.x/identicon/svg";

/** Deterministic avatar URL for a given seed (typically a Daily session ID). */
export function dicebearAvatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(seed)}`;
}
