import Link from "next/link";
import { getDailyConfig } from "@/lib/daily-config";
import { pickRandomSlogan } from "@/lib/slogans";
import CreateLinkForm from "@/components/create-link-form";

// A different slogan (see src/lib/slogans.ts / SLOGANS.md) on every load, so
// this page must not be statically prerendered — force-dynamic makes sure
// Next.js actually re-runs the pick per request rather than freezing one
// random line in at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  const { mockMode } = getDailyConfig();
  const slogan = pickRandomSlogan();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      {/* Large decorative "Q" watermark behind the card. Andreas asked for a
          big Q, serif "same font type as Times New Roman or similar, maybe
          more unique" — Playfair Display (loaded in src/app/layout.tsx),
          sized to roughly frame the content the way he sketched it. Purely
          decorative: aria-hidden, no pointer events, doesn't affect layout
          flow of the real content sitting above it (z-10). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(16rem,42vw,30rem)] leading-none font-[family-name:var(--font-playfair-display)] text-zinc-900/[0.06] dark:text-zinc-50/[0.07]"
      >
        Q
      </span>

      <main className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 text-center">
        {mockMode && (
          <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Mock mode — no Daily API key configured
          </p>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Qwickword
          </h1>
          <p className="text-base font-medium italic text-zinc-500 dark:text-zinc-400">
            {slogan}
          </p>
          <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            Set a time limit, share the link. When it hits zero, the call
            ends — there is no extend button.
          </p>
        </div>

        <CreateLinkForm />
      </main>

      {/* Discreet — deliberately low-contrast and unlabeled beyond a single
          lowercase word, not a real nav item. Andreas: "a very discreet
          little button somewhere" that links to the manifesto page. */}
      <Link
        href="/manifesto"
        className="fixed bottom-4 right-4 text-xs text-zinc-300 transition-colors hover:text-zinc-500 dark:text-zinc-800 dark:hover:text-zinc-500"
      >
        manifesto
      </Link>
    </div>
  );
}
