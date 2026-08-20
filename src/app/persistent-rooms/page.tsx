import Link from "next/link";
import type { Metadata } from "next";
import OwnedContentCta from "@/components/owned-content-cta";
import {
  SOCIAL_PREVIEW_ALT,
  SOCIAL_PREVIEW_IMAGE,
  SOCIAL_PREVIEW_URL,
} from "@/lib/social-preview";

const title = "One-off calls and Persistent Rooms in Qwickword";
const description =
  "Learn when to use a single-use Qwickword link or a stable Persistent Room, how fresh timed calls work inside a Room, and what the owner link controls.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/persistent-rooms",
    types: {
      "application/rss+xml": "https://qwickword.com/feed.xml",
    },
  },
  openGraph: {
    type: "article",
    url: "/persistent-rooms",
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
  datePublished: "2026-08-20",
  dateModified: "2026-08-20",
  author: { "@type": "Organization", name: "Qwickword" },
  publisher: { "@type": "Organization", name: "Qwickword" },
  mainEntityOfPage: "https://qwickword.com/persistent-rooms",
};

export default function PersistentRoomsPage() {
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
              Product guide
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
              One familiar door, a fresh deadline every time
            </h1>
            <p className="text-xl leading-9 text-zinc-600 dark:text-zinc-300">
              A one-off Qwickword is one conversation. A Persistent Room is a
              stable place to return to, with a new time-limited call inside it
              whenever people are ready to talk.
            </p>
          </div>
        </header>

        <section aria-labelledby="choose-heading">
          <h2 id="choose-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            Choose the link that fits the relationship
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-6">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10">
                  <th className="p-4 font-semibold text-zinc-950 dark:text-white">Use</th>
                  <th className="p-4 font-semibold text-zinc-950 dark:text-white">One-off link</th>
                  <th className="p-4 font-semibold text-zinc-950 dark:text-white">Persistent Room</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-200 dark:border-white/10">
                  <th className="p-4 font-medium text-zinc-800 dark:text-zinc-100">Address</th>
                  <td className="p-4">Fresh link for one call</td>
                  <td className="p-4">Stable link until closed or idle-expired</td>
                </tr>
                <tr className="border-b border-zinc-200 dark:border-white/10">
                  <th className="p-4 font-medium text-zinc-800 dark:text-zinc-100">Best for</th>
                  <td className="p-4">A single planned conversation</td>
                  <td className="p-4">People who expect to speak again</td>
                </tr>
                <tr>
                  <th className="p-4 font-medium text-zinc-800 dark:text-zinc-100">Time limit</th>
                  <td className="p-4">Chosen when the link is created</td>
                  <td className="p-4">A default for each fresh call, adjustable per call</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="fresh-heading">
          <h2 id="fresh-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            The Room persists; the call does not
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <p>
              Opening a Room does not start a timer or ring another person. A
              visitor chooses a duration and starts a fresh Qwickword inside
              the Room. That call still has one authoritative expiry and no
              extension control, just like a one-off link.
            </p>
            <p>
              If a call is already waiting or running, the Room points the next
              visitor to that same active call instead of creating a competing
              conversation. Once it is over, the stable Room remains available
              for the next fresh call.
            </p>
          </div>
        </section>

        <section aria-labelledby="owner-heading">
          <h2 id="owner-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            The public Room link and private owner link do different jobs
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <p>
              Anyone with the public Room link can open the Room and start or
              join a call. Guests still need no Qwickword account or download.
              The owner link adds the ability to rename the Room, change its
              default duration, or close it.
            </p>
            <p>
              Qwickword shows the owner link once and stores it on that device.
              It cannot be recovered from the public Room. Treat it like a
              private management key: do not put it in an email signature or
              send it to ordinary guests.
            </p>
          </div>
        </section>

        <section aria-labelledby="lifetime-heading" className="rounded-3xl border border-zinc-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.04]">
          <h2 id="lifetime-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">
            What a Persistent Room is not
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <p>
              It is not a ringing, scheduling, messaging, or file-sharing
              service. It is a stable rendezvous link for fresh timed calls.
              The Room closes when its owner closes it or after 90 days without
              use.
            </p>
            <p>
              A Room page keeps a limited call timeline, but it does not record
              or store call audio or video. Read the full details in the{" "}
              <Link href="/about#privacy" className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:text-white">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 border-t border-zinc-200 pt-9 dark:border-white/10">
          <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
            Start with the boundary, then choose the doorway
          </h2>
          <p>
            Make a one-off Qwickword for one conversation, or create a Room for
            people who expect to return.
          </p>
          <OwnedContentCta
            href="/"
            contentId="persistent_rooms_guide_v1"
            className="inline-flex min-h-11 items-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:focus-visible:ring-offset-black"
          >
            Create a Qwickword or Room
          </OwnedContentCta>
        </section>
      </article>
    </div>
  );
}
