import Link from "next/link";
import type { Metadata } from "next";

// The plain-spoken counterpart to /manifesto: the human reason for the
// product, the business situations it fits, and an honest account of the
// opinion about time that sits behind it.

export const metadata: Metadata = {
  title: "About",
  description:
    "Qwickword makes a short meeting invitation believable: agree the boundary before the call, then trust the room to keep it.",
  alternates: {
    canonical: "/about",
  },
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

      <article className="relative z-10 flex w-full max-w-2xl flex-col gap-10">
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
          <div className="flex max-w-xl flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              A small request you can believe
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Qwickword makes the promised length of a conversation something
              both people can rely on.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-9 text-[17px] leading-8 text-zinc-600 dark:text-zinc-300">
          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              “Do you have a minute?”
            </h2>
            <div className="mt-3 flex flex-col gap-4">
              <p>
                Most of us learn that this question rarely describes the real
                commitment. A minute can become five, twenty, or the rest of the
                hour. The rational response is often to say no. Not because the
                conversation has no value, but because its cost is unknown.
              </p>
              <p>
                Qwickword turns that vague promise into a boundary. The inviter
                chooses the length, the guest sees it before joining, and the
                room ends for everyone when the shared timer reaches zero. A
                five-minute invitation becomes easier to accept because it will
                actually be five minutes.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              Permission goes both ways
            </h2>
            <div className="mt-3 flex flex-col gap-4">
              <p>
                For an individual, Qwickword provides licence to accept a useful
                conversation without handing over an indefinite part of the day.
                It also makes setting a boundary feel natural, rather than
                abrupt or personal.
              </p>
              <p>
                For an organisation, it can make that permission part of the
                working culture: employees may propose a smaller commitment,
                decline the wrong meeting format, or ask for a defined amount of
                someone&apos;s time. That matters especially when hierarchy,
                politeness, or habit makes it difficult for one participant to
                bring a conventional meeting to an end.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              Where it earns its place
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "A focused decision or approval",
                "A project check-in or daily stand-up",
                "An expert question or office-hours slot",
                "A customer or supplier check-in",
                "An introduction or networking conversation",
                "A first conversation before booking a longer one",
              ].map((useCase) => (
                <li
                  key={useCase}
                  className="rounded-2xl border border-zinc-200 bg-white/70 px-4 py-3 text-[15px] leading-6 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                >
                  {useCase}
                </li>
              ))}
            </ul>
            <p className="mt-4">
              It is not a demand that every conversation be compressed.
              Workshops, sensitive discussions, complex negotiations, and
              anything with an honestly uncertain duration deserve a different
              format.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              An opinion, not a universal rule
            </h2>
            <div className="mt-3 flex flex-col gap-4">
              <p>
                People and cultures understand time, hospitality, hierarchy,
                boundaries, and productivity differently. Some environments
                prize exact schedules; others value the flexibility to let a
                conversation find its natural length. Qwickword does not pretend
                to represent every culture or improve every kind of work.
              </p>
              <p>
                It is a productivity tool, but it is also a small and
                intentionally opinionated experiment: what changes when the end
                of a meeting is agreed in advance and is no longer a
                negotiation?
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              The practical part
            </h2>
            <p className="mt-3">
              Choose any whole number from 1 to 30 minutes and share the link.
              The countdown starts when the second person joins, not when the
              link is created. The call runs in the browser, and the room
              enforces the ending for everyone.
            </p>
          </section>
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
