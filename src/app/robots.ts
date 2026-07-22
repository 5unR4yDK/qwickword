import type { MetadataRoute } from "next";

// Explicit allow-all robots.txt (2026-07-22, Andreas, interactive: "SEO
// optimization... AI search optimization so AIs will find it"). With no
// robots.txt at all, crawlers already default to "allowed" — but an
// explicit file removes any ambiguity for both traditional search crawlers
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
// deliberately not explicitly disallowed here. robots.txt only supports `*`
// wildcards, not real pattern matching, so there's no clean way to express
// "any single-segment path that isn't one of the known static routes."
// That's not actually a gap worth closing: those links are random,
// unguessable, never linked to from anywhere on the site or in the sitemap
// below, and expire — a crawler has no path to discover one in the first
// place, so there's nothing to explicitly keep it away from.
