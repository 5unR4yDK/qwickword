const entries = [
  {
    title: "About and privacy at Qwickword",
    url: "https://qwickword.com/about",
    description:
      "A plain-English overview of Qwickword, the conversations it is designed for, and how it handles information.",
    published: "Sun, 02 Aug 2026 00:00:00 GMT",
  },
  {
    title: "The Qwickword Manifesto",
    url: "https://qwickword.com/manifesto",
    description: "On the abolition of the meeting that would not end.",
    published: "Wed, 29 Jul 2026 00:00:00 GMT",
  },
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const dynamic = "force-static";

export function GET() {
  const items = entries
    .map(
      (entry) => `<item>
  <title>${escapeXml(entry.title)}</title>
  <link>${entry.url}</link>
  <guid isPermaLink="true">${entry.url}</guid>
  <description>${escapeXml(entry.description)}</description>
  <pubDate>${entry.published}</pubDate>
</item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Qwickword</title>
  <link>https://qwickword.com</link>
  <description>Product explanations and release notes from Qwickword.</description>
  <language>en</language>
  <lastBuildDate>Wed, 12 Aug 2026 00:00:00 GMT</lastBuildDate>
  ${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
