import HomeContent from "@/components/home-content";

// A different slogan (see src/lib/slogans.ts / SLOGANS.md) on every load, so
// this page must not be statically prerendered — force-dynamic makes sure
// Next.js actually re-runs the pick per request rather than freezing one
// random line in at build time.
export const dynamic = "force-dynamic";

// schema.org structured data (2026-07-22, Andreas, interactive: "SEO
// optimization... AI search optimization so AIs will find it"). Gives
// search engines and AI crawlers a machine-readable description of what
// Qwickword actually is, on top of the plain title/description text in
// src/app/layout.tsx — WebApplication is the schema.org type Google's own
// guidance recommends for a browser-based tool like this one (as opposed to
// SoftwareApplication, which implies something installable). Only on this
// page, deliberately — not in the shared HomeContent component, since /test
// (src/app/test/page.tsx, also built on HomeContent) is a preview route, not
// the real product page this data should be describing.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Qwickword",
  url: "https://qwickword.com",
  description:
    "Set a time limit, share the link, start talking. No account, no download — the call ends the moment the timer hits zero.",
  applicationCategory: "CommunicationApplication",
  operatingSystem: "Any (web browser)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomeContent />
    </>
  );
}
