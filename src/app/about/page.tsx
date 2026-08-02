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

          <section
            id="privacy"
            aria-labelledby="privacy-heading"
            className="scroll-mt-8 border-t border-zinc-200 pt-9 dark:border-white/10"
          >
            <div className="flex flex-col gap-2">
              <h2
                id="privacy-heading"
                className="text-2xl font-semibold text-zinc-950 dark:text-white"
              >
                Privacy policy
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                Effective 2 August 2026
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-7">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Who we are
                </h3>
                <p className="mt-2">
                  Qwickword is operated by Maurice Holdings LLC. Questions or
                  privacy requests can be sent to{" "}
                  <a
                    href="mailto:info@mauriceholdings.llc"
                    className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-700 dark:hover:text-white"
                  >
                    info@mauriceholdings.llc
                  </a>
                  .
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Information we handle
                </h3>
                <ul className="mt-3 flex list-disc flex-col gap-3 pl-5">
                  <li>
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Calls and rooms.
                    </strong>{" "}
                    We store generated room names, chosen call lengths, room
                    names you provide, timestamps, sharing method, call status,
                    and limited reliability measurements. For troubleshooting,
                    we may temporarily keep anonymous per-call lifecycle and
                    clock events plus a one-way representation of the video
                    provider&apos;s session identifiers. We do not keep participant
                    names or provider user IDs in that diagnostic record.
                    Qwickword does not record or store call audio or video.
                  </li>
                  <li>
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Optional accounts.
                    </strong>{" "}
                    Guests do not need an account. If you sign in, we store
                    your email address in encrypted form, a display name, an
                    internal user identifier, sessions, people you choose to
                    keep, signed-in call participation, and notification
                    routing information.
                  </li>
                  <li>
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Contact selection.
                    </strong>{" "}
                    The app receives only the contact you choose when composing
                    a message. The selected phone number is passed to your
                    device&apos;s message composer and is not uploaded or stored
                    by Qwickword. A selected name is saved on your device only
                    if you choose to remember it.
                  </li>
                  <li>
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Website and technical data.
                    </strong>{" "}
                    We use random first-party session identifiers, campaign
                    information, and aggregate website usage information to
                    understand whether Qwickword works and how people find it.
                    Hosting and communications providers may process technical
                    information such as IP addresses as part of delivering and
                    securing their services.
                  </li>
                  <li>
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Information kept on your device.
                    </strong>{" "}
                    Recent Qwickwords, labels you add, settings, remembered room
                    links, and room owner credentials remain on your device
                    unless you clear or remove them there.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  How we use information
                </h3>
                <p className="mt-2">
                  We use this information to create and operate calls, enforce
                  their time limits, provide optional sign-in, saved people and
                  notifications, prevent misuse, troubleshoot failures, and
                  improve reliability. We do not sell personal information,
                  use it for targeted advertising, or track you across other
                  companies&apos; apps or websites.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Google and YouTube account data
                </h3>
                <div className="mt-2 flex flex-col gap-4">
                  <p>
                    Qwickword&apos;s internal brand-publishing tool may ask the
                    owner of the official Qwickword YouTube channel to authorize
                    the Google OAuth <code>youtube.upload</code> permission. We
                    use that permission only to verify that the authorized
                    account controls the official Qwickword channel and to
                    upload founder-approved Qwickword videos. Uploads created by
                    the tool remain private for manual review unless an
                    authorized channel owner later changes their visibility in
                    YouTube.
                  </p>
                  <p>
                    The tool stores the OAuth authorization token in restricted
                    local credential storage outside the public application and
                    source repository. It sends that token and approved video
                    metadata or media only to Google&apos;s OAuth and YouTube API
                    services. Qwickword does not sell this Google user data,
                    share it with advertisers or data brokers, use it for
                    advertising, or use it to train AI models. The authorization
                    is not offered to Qwickword call participants or website
                    users.
                  </p>
                  <p>
                    The authorization is retained only while the internal
                    publishing connection is needed. The channel owner can
                    revoke access in{" "}
                    <a
                      href="https://myaccount.google.com/connections"
                      className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-700 dark:hover:text-white"
                    >
                      Google Account connections
                    </a>{" "}
                    or ask{" "}
                    <a
                      href="mailto:info@mauriceholdings.llc"
                      className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-700 dark:hover:text-white"
                    >
                      info@mauriceholdings.llc
                    </a>{" "}
                    to delete the locally stored authorization. Revoking or
                    deleting it prevents further API uploads but does not delete
                    videos already uploaded to YouTube; those can be managed in
                    YouTube Studio. Qwickword deletes locally stored Google and
                    YouTube authorization data within 30 days of a valid
                    deletion request or when the authorization can no longer be
                    verified.
                  </p>
                  <p>
                    Qwickword&apos;s use of YouTube API Services is also subject
                    to the{" "}
                    <a
                      href="https://www.youtube.com/t/terms"
                      className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-700 dark:hover:text-white"
                    >
                      YouTube Terms of Service
                    </a>{" "}
                    and the{" "}
                    <a
                      href="https://policies.google.com/privacy"
                      className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-700 dark:hover:text-white"
                    >
                      Google Privacy Policy
                    </a>
                    .
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Service providers
                </h3>
                <p className="mt-2">
                  We use service providers only where needed to operate
                  Qwickword. These include Daily for live audio and video,
                  Vercel for hosting and website analytics, Neon for database
                  hosting, Resend for sign-in emails, Expo for app updates and
                  notification delivery, and Apple or Google for device
                  notifications. They process information under their own
                  terms and privacy policies. We may also disclose information
                  when required by law or to protect Qwickword and its users.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Retention and deletion
                </h3>
                <p className="mt-2">
                  Sign-in codes expire after 10 minutes and are kept only as
                  needed for security and rate limiting. Account information is
                  kept while the account exists. You can permanently delete
                  your account and its linked server data from Settings in the
                  app. Device-only information remains until you clear it in
                  the app or remove the app. Raw call diagnostics and support
                  references are automatically deleted after 14 days. We may
                  retain de-identified
                  operational records that no longer identify or link to your
                  account, and information required for security or legal
                  obligations.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Your choices
                </h3>
                <p className="mt-2">
                  You can use guest calls without an account, decline or turn
                  off notifications, clear local recents, and delete your
                  account in the app. To ask about, correct, or request a copy
                  of information associated with you, email{" "}
                  <a
                    href="mailto:info@mauriceholdings.llc"
                    className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-700 dark:hover:text-white"
                  >
                    info@mauriceholdings.llc
                  </a>
                  . Rights may differ depending on where you live.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Children, transfers, and changes
                </h3>
                <p className="mt-2">
                  Qwickword is not directed to children under 13, and we do not
                  knowingly collect their personal information. Our providers
                  may process information in countries other than your own. We
                  will update this policy when our practices materially change
                  and will revise the effective date above.
                </p>
              </div>
            </div>
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
