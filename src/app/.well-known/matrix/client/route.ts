/**
 * Where a Qwickword address points.
 *
 * A person's address is `@name:qwickword.com`, so a client handed that address
 * asks THIS site where the messaging server actually is. Without this document
 * the address does not resolve, and what a person sees is not "discovery
 * failed" — it is being told their account does not exist.
 *
 * The messaging stack runs on its own machine under its own name, which is why
 * this site answers on its behalf. The same document is produced by that
 * machine's proxy configuration in the platform repository
 * (`infrastructure/shared/hosted/route-map.mjs`); this application is separate
 * and cannot import it, so the shape is restated and the tests pin it.
 *
 * Self-contained, like the Apple association beside it: the unit tests import
 * these routes directly under plain node, which resolves neither the `@/lib`
 * alias nor a bare TypeScript path.
 */
export const MATRIX_CLIENT_DELEGATION = {
  "m.homeserver": { base_url: "https://app.qwickword.com" },
  "m.identity_server": {},
} as const;

/**
 * `Access-Control-Allow-Origin: *` because a browser-based client fetches this
 * from its own origin before any session exists; without it the fetch is
 * blocked and the client reports only that the server could not be found. The
 * document is public by design and carries no secret. The cache is short so
 * that moving the messaging server is not a day of waiting for caches.
 */
export const DELEGATION_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
} as const;

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(MATRIX_CLIENT_DELEGATION, { headers: { ...DELEGATION_HEADERS } });
}
