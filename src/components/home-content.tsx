import Link from "next/link";
import { getDailyConfig } from "@/lib/daily-config";
import { pickRandomSlogan } from "@/lib/slogans";
import CreateLinkForm from "@/components/create-link-form";

/**
 * The home page's actual content — extracted out of src/app/page.tsx
 * (2026-07-22) so the v2 call UI preview's landing page
 * (src/app/test/page.tsx) can render the exact same markup, one prop
 * different. Andreas, interactive, after seeing the preview's landing page
 * look nothing like the real one: "those two pages should be completely
 * identical in both functionalities and in UI... everything from creating
 * it to the confirmation to all everything." A hand-duplicated copy of this
 * JSX in two files could only ever drift over time as one got tweaked and
 * not the other — a single shared component makes that impossible.
 *
 * `basePath` is the only thing that varies: "" for the real flow
 * (CreateLinkForm builds `/[room]` links), "/test" for the preview
 * (`/test/[room]` links, which render the new call-object-mode UI instead
 * of today's Daily Prebuilt iframe — see CALL_UI_REBUILD_SPEC.md). Nothing
 * else about the page differs, on purpose.
 */
export default function HomeContent({ basePath = "" }: { basePath?: string }) {
  const { mockMode } = getDailyConfig();
  const slogan = pickRandomSlogan();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      {/* Ambient background glow, spreading out from the Q (2026-07-22,
          Andreas, interactive: "a little bit more sort of a purple hue dark
          deep purple a deep marine blue mix hue that sort of spreads out
          from the main letter Q in the middle... instead of isolated just
          to the square in the middle"). A prior attempt at a background glow
          (2026-07-21, fourth pass) was rejected for looking like a "weird
          square" — that version was a single radial gradient sized closer to
          the viewport, so its falloff edge was still visible as a boundary.
          This version avoids that the same way real ambient light does:
          two oversized (90vmax/70vmax — well past any screen edge at normal
          zoom), heavily blurred, low-opacity circles, each fading smoothly
          to fully transparent well before its own edge, so there's no
          boundary left to read as a shape. Two overlapping colours per
          Andreas's ask — violet/indigo for the purple half, a deep
          teal/marine blue (Tailwind's cyan-950/sky-900 range) for the other
          — offset slightly from each other so they blend into one soft wash
          rather than a flat single-colour glow. `mix-blend-screen` lets the
          two colours actually combine where they overlap instead of one
          flatly occluding the other. Sits below the Q glyph and the card in
          DOM order, so both still read clearly on top of it. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[90vmax] w-[90vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.30)_0%,rgba(99,102,241,0.10)_35%,transparent_68%)] blur-3xl mix-blend-screen dark:bg-[radial-gradient(circle,rgba(129,140,248,0.28)_0%,rgba(129,140,248,0.10)_35%,transparent_68%)]" />
        <div className="absolute top-1/2 left-1/2 h-[75vmax] w-[75vmax] translate-x-[6%] translate-y-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(8,51,68,0.42)_0%,rgba(8,51,68,0.14)_40%,transparent_70%)] blur-3xl mix-blend-screen dark:bg-[radial-gradient(circle,rgba(14,116,144,0.32)_0%,rgba(14,116,144,0.12)_40%,transparent_70%)]" />
      </div>

      {/* Large decorative "Q" watermark behind the card. Andreas asked for a
          big Q, serif "same font type as Times New Roman or similar, maybe
          more unique" — Playfair Display (loaded in src/app/layout.tsx),
          sized to roughly frame the content the way he sketched it. Purely
          decorative: aria-hidden, no pointer events, doesn't affect layout
          flow of the real content sitting above it (z-10). Bumped opacity and
          added an indigo tint (2026-07-21, second pass) after Andreas said
          the first version was "hardly visible" and asked for something a
          little more inspiring. Blurred the glyph itself (2026-07-21, third
          pass): the part of the Q sitting behind the glass card was already
          soft (thanks to the card's own backdrop-blur), but the tail poking
          out below the card rendered crisp against the plain background, so
          it read as a stray sharp shape rather than part of the same glow. A
          uniform blur filter on the whole span fixes that mismatch
          everywhere, not just under the card. */}
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

        <CreateLinkForm basePath={basePath} />

        {/* Still discreet — muted, unlabeled beyond a single lowercase word,
            not styled as a real nav item — but moved into the main content
            flow itself (2026-07-22, Andreas, interactive: "I want to keep
            the manifesto link a discreet but it should be easier to spot...
            maybe it doesn't have to be at bottom right maybe it can be
            something more visible but still muted"). The old placement — a
            fixed corner of the whole viewport, `text-zinc-300` (nearly
            invisible against the light background) — meant actually finding
            it required knowing to look in the corner first. Living here,
            underneath the create-link form, it's inside the one card
            everyone's eyes are already on, so it gets seen without needing
            to be loud: still small, still muted, just no longer requiring a
            treasure hunt. Contrast nudged up a notch from the old
            zinc-300/zinc-800 (readable now, not just guessable) while
            staying clearly secondary to everything above it. */}
        <Link
          href="/manifesto"
          className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          manifesto
        </Link>
      </main>
    </div>
  );
}
