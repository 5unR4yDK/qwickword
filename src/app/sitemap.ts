import type { MetadataRoute } from "next";

// Only lists the site's real, permanent, indexable pages — the homepage,
// the about page, and the manifesto. Room links
// (qwickword.com/<random>) are single-use and expire, so they're
// deliberately excluded — see the note in src/app/robots.ts for why that's
// not a gap that needs closing.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://qwickword.com",
      lastModified: "2026-07-30",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://qwickword.com/about",
      lastModified: "2026-07-29",
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: "https://qwickword.com/manifesto",
      lastModified: "2026-07-29",
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
