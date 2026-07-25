import HomeContent from "@/components/home-content";

// schema.org structured data. Gives search engines and AI crawlers a
// machine-readable description of what
// Qwickword actually is, on top of the plain title/description text in
// src/app/layout.tsx — WebApplication is the schema.org type Google's own
// guidance recommends for a browser-based tool like this one (as opposed to
// SoftwareApplication, which implies something installable).
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
