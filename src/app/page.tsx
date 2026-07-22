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
          flow of the real content sitting above it (z-10). Bumped opacity and
          added an indigo tint (2026-07-21, second pass) after Andreas said
          the first version was "hardly visible" and asked for something a
          little more inspiring — originally paired with a soft radial
          background glow, which Andreas then said made the page look like it
          had a "weird" square in it (2026-07-21, fourth pass) — that
          background gradient is gone, the page is back to a flat
          bg-zinc-50/black, and the Q + glass card below now carry the
          "inspiring" feel on their own. Blurred the glyph itself
          (2026-07-21, third pass): the part of the Q sitting behind the
          glass card was already soft (thanks to the card's own
          backdrop-blur), but the tail poking out below the card rendered
          crisp against the plain background, so it read as a stray sharp
          shape rather than part of the same glow. A uniform blur filter on
          the whole span fixes that mismatch everywhere, not just under the
          card. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(17rem,44vw,32rem)] leading-none font-[family-name:var(--font-playfair-display)] text-indigo-500/[0.22] blur-md dark:text-indigo-300/[0.26]"
      >
        Q
      </span>

      <main className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-black/[.06] bg-white/60 px-8 py-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/[.08] dark:bg-white/[.04]">
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
            Set a time limit, share the link. When the timer hits zero, the
            call ends.
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
