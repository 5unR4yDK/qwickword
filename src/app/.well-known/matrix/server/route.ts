/**
 * The host and port the call service's OpenID validation resolves to.
 *
 * The companion of the client document beside this one, and restated here for
 * the same reason: this application cannot import the messaging server's proxy
 * configuration, and the unit tests import this route directly under plain
 * node. See the client route for the whole explanation.
 */
export const MATRIX_SERVER_DELEGATION = { "m.server": "app.qwickword.com:443" } as const;

export const DELEGATION_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
} as const;

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(MATRIX_SERVER_DELEGATION, { headers: { ...DELEGATION_HEADERS } });
}
