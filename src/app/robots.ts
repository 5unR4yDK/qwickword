import type { MetadataRoute } from "next";

// Explicit allow-all robots.txt. With no robots.txt at all, crawlers already
// default to "allowed" — but an explicit file removes any ambiguity for
// both traditional search crawlers
// and AI crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, and
// similar all read the same generic robots.txt convention), and points them
// at the sitemap. See src/app/sitemap.ts and public/llms.txt for the rest
// of this pass.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://qwickword.com/sitemap.xml",
  };
}

// Note on room links (e.g. qwickword.com/YvgkGE7B14TSaOHV261w?exp=...&d=...):
// deliberately not disallowed here. A disallow rule would keep a crawler from
// reading the page-level `noindex` directive emitted by both call and
// persistent-room routes. Those URLs stay out of the sitemap and declare
// `noindex, nofollow` themselves, while remaining fetchable by link-preview
// bots so an invite can still show its safe, duration-specific card.
