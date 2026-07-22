import type { MetadataRoute } from "next";

// 2026-07-22, Andreas, interactive: "SEO optimization... AI search
// optimization". Only lists the site's two real, permanent, indexable
// pages — the homepage and the manifesto easter egg. Room links
// (qwickword.com/<random>) are single-use and expire, so they're
// deliberately excluded — see the note in src/app/robots.ts for why that's
// not a gap that needs closing.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://qwickword.com",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://qwickword.com/manifesto",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
