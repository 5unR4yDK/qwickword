import Link from "next/link";
import type { Metadata } from "next";
import OwnedContentCta from "@/components/owned-content-cta";
import {
  SOCIAL_PREVIEW_ALT,
  SOCIAL_PREVIEW_IMAGE,
  SOCIAL_PREVIEW_URL,
} from "@/lib/social-preview";

const title = "How Qwickword ends a video call on time";
const description =
  "See when a Qwickword countdown starts, how the shared deadline is enforced, what your guest needs, and the practical limits of a timed browser call.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/how-qwickword-works",
    types: {
      "application/rss+xml": "https://qwickword.com/feed.xml",
    },
  },
  openGraph: {
    type: "article",
    url: "/how-qwickword-works",
    siteName: "Qwickword",
    title: `${title} | Qwickword`,
    description,
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Qwickword`,
    description,
    images: [{ url: SOCIAL_PREVIEW_URL, alt: SOCIAL_PREVIEW_ALT }],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: title,
  description,
  datePublished: "2026-08-15",
  dateModified: "2026-08-16",
  author: { "@type": "Organization", name: "Qwickword" },
  publisher: { "@type": "Organization", name: "Qwickword" },
  mainEntityOfPage: "https://qwickword.com/how-qwickword-works",
};

export default function HowQwickwordWorksPage() {
  return (
    <div className="relative flex flex-1 justify-center overflow-hidden bg-zinc-50 px-6 py-20 dark:bg-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 h-[1300px] w-[1300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.09)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen"
      />

      <article className="relative z-10 flex w-full max-w-2xl flex-col gap-10 text-[17px] leading-8 text-zinc-600 dark:text-zinc-300">
        <header className="flex flex-col gap-5">
          <Link
            href="/"
            className="w-fit text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-300 dark:decoration-zinc-700 dark:hover:text-white"
          >
            Back to Qwickword
          </Link>
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold tracking-[0.16em] text-cyan-700 uppercase dark:text-[#3DFEF1]">
              How it works
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
              A shared deadline, not a polite suggestion
            </h1>
            <p className="text-xl leading-9 text-zinc-600 dark:text-zinc-300">
              Qwickword puts the end of a short video call into the room itself.
              Both people see the same countdown, and the room closes when it
              reaches zero.
            </p>
          </div>
        </header>

        <section aria-labelledby="before-heading">
          <h2 id="before-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            1. Agree the boundary before joining
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <p>
              The inviter chooses any whole number from 1 to 30 minutes.
              Qwickword creates one link that shows the promised length before
              the guest enters the call. The guest needs a current browser,
              but no Qwickword account or app download.
            </p>
            <p>
              Creating the link does not consume the conversation time. The
              invitation has a separate pre-start window, so the countdown is
              waiting for the people, not racing them to the room.
            </p>
          </div>
        </section>

        <section aria-labelledby="start-heading">
          <h2 id="start-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            2. Start from a real shared moment
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <p>
              Normally, the countdown starts when the second participant joins.
              That means both people receive the time they agreed to, even if
              one arrives early. The creator can also choose Start now when a
              one-person timed session is intentional.
            </p>
            <p>
              The server records one authoritative expiry time. Each browser
              uses that same deadline rather than running an independent local
              stopwatch, which keeps the visible timers aligned.
            </p>
          </div>
        </section>

        <section aria-labelledby="zero-heading">
          <h2 id="zero-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            3. Make zero an actual ending
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <p>
              When the call starts, Qwickword gives the video provider the same
              expiry timestamp shown by the countdown. The provider is
              configured to eject participants at that point, while the browser
              also moves everyone to the ended state.
            </p>
            <p>
              There is no extend button. If the conversation deserves more
              time, the participants can make a new decision after the first
              commitment has been honoured.
            </p>
          </div>
        </section>

        <section aria-labelledby="limits-heading" className="rounded-3xl border border-zinc-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.04]">
          <h2 id="limits-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            What the hard stop does not promise
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <p>
              Qwickword can enforce the room&apos;s shared expiry. It cannot make
              a weak network stable, grant camera or microphone permission, or
              prevent a browser, device, or video provider from becoming
              unavailable. Those are ordinary dependencies of a browser video
              call.
            </p>
            <p>
              Qwickword does not record or store call audio or video. It keeps
              limited room, sharing, status, and reliability information needed
              to operate and improve the service. The full explanation is in
              the <Link href="/about#privacy" className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:text-white">privacy policy</Link>.
            </p>
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 border-t border-zinc-200 pt-9 dark:border-white/10">
          <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
            Make the time clear before you connect
          </h2>
          <p>
            Choose a duration, send one link, and let the shared deadline do the
            awkward part for both people.
          </p>
          <OwnedContentCta
            href="/"
            contentId="how_qwickword_works"
            className="inline-flex min-h-11 items-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:focus-visible:ring-offset-black"
          >
            Create a Qwickword
          </OwnedContentCta>
        </section>
      </article>
    </div>
  );
}
