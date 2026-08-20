import type { MetadataRoute } from "next";

// Only lists the site's real, permanent, indexable pages — the homepage,
// the about page, the product guides, and the manifesto. Room links
// (qwickword.com/<random>) are single-use and expire, so they're
// deliberately excluded — see the note in src/app/robots.ts for why that's
// not a gap that needs closing.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://qwickword.com",
      lastModified: "2026-08-16",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://qwickword.com/how-qwickword-works",
      lastModified: "2026-08-16",
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://qwickword.com/persistent-rooms",
      lastModified: "2026-08-20",
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://qwickword.com/about",
      lastModified: "2026-08-15",
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: "https://qwickword.com/manifesto",
      lastModified: "2026-08-12",
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
