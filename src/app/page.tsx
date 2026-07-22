import HomeContent from "@/components/home-content";

// A different slogan (see src/lib/slogans.ts / SLOGANS.md) on every load, so
// this page must not be statically prerendered — force-dynamic makes sure
// Next.js actually re-runs the pick per request rather than freezing one
// random line in at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return <HomeContent />;
}
