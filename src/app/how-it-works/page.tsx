import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How the hard stop works",
  description:
    "How Qwickword creates a timed browser video call, starts the shared countdown, and ends the room for everyone at zero.",
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowItWorksPage() {
  return (
    <div className="relative flex flex-1 justify-center overflow-hidden bg-zinc-50 px-6 py-20 dark:bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.09)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen"
      />

      <article className="relative z-10 flex w-full max-w-2xl flex-col gap-10 text-zinc-700 dark:text-zinc-300">
        <header className="flex flex-col items-center gap-4 text-center">
          <Link href="/" aria-label="Qwickword home">
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
          </Link>
          <div className="flex max-w-xl flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              How a Qwickword ends on time
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              A visible timer is easy to ignore. Qwickword makes the chosen
              limit part of the room itself, so zero is an ending rather than
              a suggestion.
            </p>
          </div>
        </header>

        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            {
              number: "1",
              title: "Choose the limit",
              body: "Pick a preset or set any whole number from 1 to 30 minutes.",
            },
            {
              number: "2",
              title: "Share one link",
              body: "Your guest opens it in a browser. They do not need an account or download.",
            },
            {
              number: "3",
              title: "Reach zero",
              body: "The shared countdown begins when the second person arrives. At zero, the room ends for both people.",
            },
          ].map((step) => (
            <li
              key={step.number}
              className="rounded-2xl border border-zinc-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#3DFEF1] text-sm font-bold text-[#062B28]">
                {step.number}
              </span>
              <h2 className="font-semibold text-zinc-950 dark:text-white">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-8 text-[17px] leading-8">
          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              When does the timer start?
            </h2>
            <p className="mt-2">
              Not when the link is created. A new room waits for the people
              using it. The real countdown starts when a second participant
              joins, so time spent sending or opening the link does not consume
              the conversation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              What makes the stop different?
            </h2>
            <p className="mt-2">
              The room provider receives the expiry, and the interface has no
              extend control. Closing, refreshing, or ignoring a timer in one
              browser cannot turn the same room into a longer call. If the
              conversation needs more time, create a fresh Qwickword or choose
              a regular meeting tool instead.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              What does the guest need?
            </h2>
            <p className="mt-2">
              A current browser with camera and microphone permission. There
              is no guest account and no app installation in the web flow. The
              pre-join screen shows the chosen duration before the guest enters
              the room.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              Is every conversation a fit?
            </h2>
            <p className="mt-2">
              No. Qwickword is for conversations that can honestly fit inside
              a pre-agreed cap: a clarification, a check-in, or a focused
              decision. Workshops, interviews, and anything that needs an
              uncertain amount of time deserve a different format.
            </p>
          </section>
        </div>

        <footer className="flex flex-col items-center gap-4 border-t border-zinc-200 pt-8 text-center dark:border-white/10">
          <Link
            href="/"
            className="flex h-12 items-center rounded-full bg-[#3DFEF1] px-[26px] text-[15px] font-semibold text-[#062B28] transition-colors hover:bg-[#7FFFF5]"
          >
            Create a timed call
          </Link>
          <Link
            href="/about"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Read the plain-English overview
          </Link>
        </footer>
      </article>
    </div>
  );
}
