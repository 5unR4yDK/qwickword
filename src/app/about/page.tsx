import Link from "next/link";
import type { Metadata } from "next";

// The plain-spoken counterpart to /manifesto: a short, factual page that
// explains what Qwickword is and how it works, for anyone who wants the
// straight answer rather than the speech. Static content, plain Server
// Component.

export const metadata: Metadata = {
  title: "About",
  description:
    "What Qwickword is and how it works: time-limited video calls that end on their own.",
};

export default function AboutPage() {
  return (
    <div className="relative flex flex-1 justify-center overflow-hidden bg-zinc-50 px-6 py-20 dark:bg-black">
      {/* Same ambient glow language as the rest of the site; a no-op on the
          light theme via mix-blend-screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.09)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen"
      />

      <article className="relative z-10 flex w-full max-w-xl flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wordmark-only.svg"
            alt="qwickword.com"
            className="hidden h-auto w-[260px] max-w-[70vw] dark:block"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wordmark-only-black.svg"
            alt="qwickword.com"
            className="h-auto w-[260px] max-w-[70vw] dark:hidden"
          />
          <h1 className="text-[22px] font-medium text-zinc-900 dark:text-[#FAFAFA]">
            About Qwickword
          </h1>
        </header>

        <div className="flex flex-col gap-5 text-[17px] leading-7 text-zinc-600 dark:text-[#A1A1AA]">
          <p>
            Qwickword is a free video calling tool with one idea: you decide
            how long the call is before it starts, and when the timer hits
            zero, the call ends. For everyone, automatically, with no extend
            button.
          </p>
          <p>
            You pick a length between 1 and 30 minutes, get a shareable link,
            and send it to whoever you&apos;re meeting. The countdown starts
            when the second person joins — not when the link is created — so
            a link can sit unopened without wasting the call&apos;s own time.
            Once the timer runs out, the room is gone. Qwickword is built for
            conversations that fit inside the cap — if yours needs longer
            than that, a regular call is the better tool for it.
          </p>
          <p>
            There are no accounts, nothing to download, and nothing to
            install. Calls run in the browser, and the time limit is enforced
            on the server, not by a clock in your tab — so it can&apos;t be
            bypassed by anyone on the call.
          </p>
          <p>
            It&apos;s for the conversations that deserve a container: a quick
            decision, a daily check-in, a catch-up that shouldn&apos;t swallow
            an afternoon. Knowing the call ends changes how people talk while
            it lasts.
          </p>
        </div>

        <footer className="flex flex-col items-center gap-4">
          <Link
            href="/"
            className="flex h-12 items-center rounded-full bg-[#3DFEF1] px-[26px] text-[15px] font-semibold text-[#062B28] transition-colors duration-150 hover:bg-[#7FFFF5]"
          >
            Try it
          </Link>
          <Link
            href="/manifesto"
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-[#52525B] dark:hover:text-zinc-400"
          >
            or read the manifesto
          </Link>
        </footer>
      </article>
    </div>
  );
}
