import Link from "next/link";
import type { Metadata } from "next";
import {
  SOCIAL_PREVIEW_ALT,
  SOCIAL_PREVIEW_IMAGE,
  SOCIAL_PREVIEW_URL,
} from "@/lib/social-preview";

/**
 * /join — the page you send to a person you want on the phone app.
 *
 * WHY THIS PAGE DOES NOT HAVE A SIGN-UP FORM
 * ------------------------------------------
 * Accounts are created on app.qwickword.com, which is the sign-in service
 * the iPhone app authenticates against. An account only works in the app if
 * it exists *there*. This page therefore explains and hands off; it does not
 * collect a username, an email address or a password.
 *
 * That hand-off is the correct architecture, not a shortcut we have not got
 * around to fixing. Building a form here would mean a second surface holding
 * credentials, a second copy of the account rules to keep in sync, and the
 * real possibility of minting an account the app will not accept. If you are
 * tempted to "improve" this page by adding a form, the improvement belongs on
 * app.qwickword.com instead.
 *
 * WHAT WILL CHANGE, AND WHERE
 * ---------------------------
 * 1. TESTFLIGHT_LINK below is null until Apple's beta review clears and a
 *    public invitation link exists. Set the constant, change nothing else.
 * 2. Step 3 describes today's sign-in route (phone shows a code, you approve
 *    it in a browser). Direct sign-in on the phone is being added. When it
 *    lands, the body of step 3 is the only part that needs rewriting — the
 *    step, its heading and everything around it stay as they are.
 *
 * No attribution instrumentation here on purpose: this is a page handed to a
 * named person, not owned content we are measuring acquisition from.
 */

// The one edit this file needs when Apple's beta review clears: paste the
// public TestFlight invitation link here. Until then it stays null and the
// page says, truthfully, that there is nothing to install yet.
const TESTFLIGHT_LINK: string | null = null;

const ACCOUNT_URL = "https://app.qwickword.com/auth/register";
const APPROVE_URL = "https://app.qwickword.com/auth/link";

const title = "Join Qwickword";
const description =
  "Three steps to get Qwickword on your phone: create your account, install the app, and sign in.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/join",
    types: {
      "application/rss+xml": "https://qwickword.com/feed.xml",
    },
  },
  openGraph: {
    type: "website",
    url: "/join",
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

const primaryButton =
  "inline-flex min-h-11 w-fit items-center rounded-full bg-[#3DFEF1] px-6 py-3 text-[15px] font-semibold text-[#062B28] transition-colors hover:bg-[#7FFFF5] focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-[#3DFEF1] dark:focus-visible:ring-offset-black";

const inlineLink =
  "font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:text-white dark:focus-visible:ring-[#3DFEF1]";

function Step({
  number,
  heading,
  children,
}: {
  number: number;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-5">
      <span
        aria-hidden="true"
        className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-cyan-hairline)] bg-[color:var(--brand-cyan-wash)] text-[15px] font-semibold text-cyan-800 dark:text-[#3DFEF1]"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
          {heading}
        </h2>
        {children}
      </div>
    </li>
  );
}

export default function JoinPage() {
  return (
    <main className="relative flex flex-1 justify-center overflow-hidden bg-zinc-50 px-6 py-20 dark:bg-black">
      {/* Same ambient glow as the other content pages; a no-op in light mode
          thanks to mix-blend-screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 h-[1300px] w-[1300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.09)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen"
      />

      <article className="relative z-10 flex w-full max-w-2xl flex-col gap-12 text-[17px] leading-8 text-zinc-600 dark:text-zinc-300">
        <header className="flex flex-col gap-5">
          <Link href="/" className={`w-fit text-sm ${inlineLink}`}>
            Back to Qwickword
          </Link>
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold tracking-[0.16em] text-cyan-700 uppercase dark:text-[#3DFEF1]">
              Early access
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
              Get Qwickword on your phone
            </h1>
            <p className="text-xl leading-9 text-zinc-600 dark:text-zinc-300">
              Three steps. The first one takes a minute, and you only ever do it
              once.
            </p>
          </div>
        </header>

        <ol className="flex flex-col gap-12">
          <Step number={1} heading="Create your account">
            <p>
              Accounts are made at{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                app.qwickword.com
              </span>
              . That is still Qwickword — it is the part that looks after
              sign-ins — so the web address gains an{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                app.
              </span>{" "}
              at the front and the page looks plainer than this one. Nothing has
              gone wrong.
            </p>
            <p>
              You will choose a username, give an email address, and set a
              password. Nothing else.
            </p>
            <a href={ACCOUNT_URL} className={primaryButton}>
              Create your account
            </a>
            <p className="text-[15px] leading-7 text-zinc-500 dark:text-zinc-400">
              Opens app.qwickword.com. Come back here afterwards.
            </p>
          </Step>

          <Step number={2} heading="Install the app">
            <p>
              Qwickword is on iPhone for now. It arrives through TestFlight,
              which is Apple&apos;s own app for trying an app before it reaches
              the App Store: you install TestFlight first, then Qwickword
              through it.
            </p>
            {TESTFLIGHT_LINK ? (
              <a href={TESTFLIGHT_LINK} className={primaryButton}>
                Get the app through TestFlight
              </a>
            ) : (
              <p className="rounded-2xl border border-zinc-200 bg-white/70 px-5 py-4 text-[15px] leading-7 dark:border-white/10 dark:bg-white/[0.04]">
                There is no invitation link to give you yet. Apple reviews an
                app before its invitations can be handed out, and Qwickword is
                still waiting in that queue. Reply to whoever sent you this page
                and you will get the link the moment it exists.
              </p>
            )}
          </Step>

          <Step number={3} heading="Sign in on your phone">
            <p>
              Open Qwickword on the phone and choose{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                Sign in from another device
              </span>
              . The phone shows six letters.
            </p>
            <p>
              On a computer, open{" "}
              <a href={APPROVE_URL} className={inlineLink}>
                app.qwickword.com/auth/link
              </a>
              , type in those six letters, and approve it. The phone signs
              itself in a moment later.
            </p>
            <p className="text-[15px] leading-7 text-zinc-500 dark:text-zinc-400">
              It is a long way round, and it is being shortened. If your copy of
              the app offers to sign you in on the phone itself, use that — it
              is the same account either way.
            </p>
          </Step>
        </ol>

        <section
          aria-labelledby="stuck-heading"
          className="flex flex-col gap-3 border-t border-zinc-200 pt-9 dark:border-white/10"
        >
          <h2
            id="stuck-heading"
            className="text-2xl font-semibold text-zinc-950 dark:text-white"
          >
            If you get stuck
          </h2>
          <p>
            Say so — a step that does not work is worth knowing about. Email{" "}
            <a href="mailto:info@mauriceholdings.llc" className={inlineLink}>
              info@mauriceholdings.llc
            </a>{" "}
            or just reply to whoever sent you here.
          </p>
          <p>
            You do not need any of this to be on the receiving end of a
            Qwickword. Anyone can open a call link in a browser with no account
            and no download — this is only for having the app itself.{" "}
            <Link href="/how-qwickword-works" className={inlineLink}>
              How Qwickword works
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
