import Link from "next/link";
import { getDailyConfig } from "@/lib/daily-config";
import CallCountdown from "@/components/call-countdown";

/**
 * Call page (Phase 0 item 5): joins the Daily room named by the `[room]`
 * segment and shows a countdown synced to the `exp` query param.
 *
 * Deliberately stateless (no database — see BUILD_PLAN.md / ROADMAP.md
 * Phase 1's "no database until a feature needs one" decision): the link
 * created by CreateLinkForm already carries `exp` (the room's Unix expiry
 * timestamp) as a query param, so this page needs no server-side lookup to
 * know the countdown target. Both parties opening the same link see the
 * same `exp`, hence the same countdown.
 *
 * Scope for tonight, matching this roadmap item's "Done when": two browser
 * tabs can connect to the same room and see the same countdown. What this
 * page deliberately does NOT yet do (later roadmap items, not this one):
 * - Verify the room still exists on Daily before rendering (the "invalid /
 *   expired link" friendly screen is the very next Phase 0 item).
 * - Force a "no rejoin, no extend" hard-end screen when the countdown hits
 *   zero (the "Hard-end experience" item right after that). The actual
 *   enforcement already happens server-side today, via `eject_at_room_exp`
 *   / `eject_after_elapsed` on the Daily room (Phase 0 item 3) — what's
 *   missing until the next item is this page's own post-expiry UI polish.
 */

type Props = {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ exp?: string | string[] }>;
};

export default async function RoomPage({ params, searchParams }: Props) {
  const { room } = await params;
  const { exp: rawExp } = await searchParams;
  const expParam = Array.isArray(rawExp) ? rawExp[0] : rawExp;
  const exp = expParam ? Number(expParam) : NaN;
  const hasValidExp = Number.isFinite(exp) && exp > 0;

  const { mockMode, domain } = getDailyConfig();
  const joinUrl = mockMode ? null : `https://${domain}/${room}`;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Quick Word
        </h1>
        {hasValidExp ? (
          <CallCountdown exp={exp} />
        ) : (
          <p className="max-w-md text-sm text-amber-700 dark:text-amber-400">
            This link is missing its time-limit info, so a countdown can&apos;t
            be shown here — but if it&apos;s a real room, Daily still ends it
            server-side on schedule.
          </p>
        )}
      </div>

      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-black/[.08] bg-black dark:border-white/[.145]"
        style={{ aspectRatio: "16 / 9" }}
      >
        {mockMode ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-300">
            <p className="text-base font-medium">
              Mock call — no Daily API key configured
            </p>
            <p className="text-sm text-zinc-400">Room: {room}</p>
          </div>
        ) : (
          <iframe
            src={joinUrl ?? undefined}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-full w-full border-0"
            title="Quick Word call"
          />
        )}
      </div>

      {!mockMode && joinUrl && (
        <a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Having trouble? Open the call in a new tab
        </a>
      )}

      <Link
        href="/"
        className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        Create your own Quick Word
      </Link>
    </div>
  );
}
