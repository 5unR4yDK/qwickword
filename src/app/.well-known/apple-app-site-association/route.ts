const APP_ID = "UL24D2Q894.llc.mauriceholdings.qwickword";

/**
 * Only URLs that represent something the iPhone app can actually open belong
 * here. Root marketing pages, APIs and assets stay in the browser.
 *
 * The modern `components` form is first. The legacy `paths` form keeps the
 * association understandable to older Apple clients without broadening it.
 */
export const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: [APP_ID],
        components: [
          { "/": "/", exclude: true, comment: "Keep the homepage on the web." },
          { "/": "/r", exclude: true, comment: "A room link needs a slug." },
          { "/": "/about", exclude: true },
          { "/": "/manifesto", exclude: true },
          { "/": "/how-it-works", exclude: true },
          { "/": "/api/*", exclude: true },
          { "/": "/_next/*", exclude: true },
          { "/": "/.well-known/*", exclude: true },
          { "/": "/brand/*", exclude: true },
          { "/": "/*.svg", exclude: true },
          { "/": "/*.png", exclude: true },
          { "/": "/*.ico", exclude: true },
          { "/": "/*.txt", exclude: true },
          { "/": "/*.xml", exclude: true },
          { "/": "/*.html", exclude: true },
          {
            "/": "/r/*",
            comment: "Open a persistent Qwickword room in the app.",
          },
          {
            "/": "/*",
            comment: "Open a one-segment Qwickword call link in the app.",
          },
        ],
      },
      {
        appID: APP_ID,
        paths: [
          "NOT /",
          "NOT /r",
          "NOT /about",
          "NOT /manifesto",
          "NOT /how-it-works",
          "NOT /api/*",
          "NOT /_next/*",
          "NOT /.well-known/*",
          "NOT /brand/*",
          "NOT /*.svg",
          "NOT /*.png",
          "NOT /*.ico",
          "NOT /*.txt",
          "NOT /*.xml",
          "NOT /*.html",
          "/r/*",
          "/*",
        ],
      },
    ],
  },
} as const;

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(APPLE_APP_SITE_ASSOCIATION, {
    headers: {
      // Apple accepts JSON or its signed PKCS#7 form. Be explicit so the
      // framework never guesses from this intentionally extensionless path.
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
