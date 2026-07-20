"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CallCountdown from "@/components/call-countdown";
import CallMedia from "@/components/call-media";

type Props = {
  room: string;
  exp: number;
  /**
   * Remaining milliseconds computed by the server (page.tsx), using the
   * server's own clock at request time: `exp * 1000 - Date.now()`. Passing
   * this down as a prop — rather than each side independently calling
   * `Date.now()` during render — means the server-rendered HTML and the
   * client's first render use the exact same number, so there is no
   * hydration-mismatch risk, and no placeholder tick is needed before the
   * real state is known.
   *
   * The useful side effect: an already-expired link renders the ended
   * screen directly in the server-rendered HTML, on the very first
   * response — the call area (CallMedia, including the Daily iframe) is
   * never sent to the browser at all for a dead link, not even for a
   * flash before JavaScript runs.
   */
  initialRemainingMs: number;
  mockMode: boolean;
  joinUrl: string | null;
};

/**
 * Owns the live, ticking portion of the call page (Phase 0 item 6,
 * "Hard-end experience"): the clock, the call area (CallMedia — a Daily
 * iframe or the mock placeholder), and the hard swap to a "Time's up" screen
 * once the shared `exp` passes.
 *
 * The swap unmounts CallMedia entirely rather than just hiding it — React
 * removes the `<iframe>` from the DOM, which drops this tab's side of the
 * call, and there is no path back to it from the ended screen: no rejoin
 * button, no "open in new tab" link (that link pointed at the same,
 * now-expired room), nothing that continues or restarts *this* call. That's
 * a client-side belt to Daily's server-side suspenders
 * (`eject_at_room_exp` / `eject_after_elapsed`, already enforced since
 * Phase 0 item 3 — see src/lib/daily-rooms.ts): even if this page's own
 * 1-second-granularity timer fires a moment before or after Daily's own
 * enforcement, the user has no control on this page that keeps the call
 * going. The only interactive elements here are links to `/` (a new room,
 * not a continuation of this one): the explicit "Create a new one" button
 * added in Phase 0 item 7 for a call that just ended mid-session, plus the
 * page's own persistent "Create your own Quick Word" footer link (rendered
 * one level up, in page.tsx's PageShell, unchanged by this component).
 */
export default function CallRoom({
  room,
  exp,
  initialRemainingMs,
  mockMode,
  joinUrl,
}: Props) {
  const [remainingMs, setRemainingMs] = useState<number>(initialRemainingMs);

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(exp * 1000 - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [exp]);

  const isOver = remainingMs <= 0;

  return (
    <>
      <CallCountdown remainingMs={remainingMs} />

      {isOver ? (
        <div
          role="status"
          className="flex w-full max-w-3xl flex-col items-center gap-3 rounded-2xl border border-black/[.08] bg-white px-6 py-16 text-center dark:border-white/[.145] dark:bg-zinc-950"
        >
          <p className="text-lg font-medium text-black dark:text-zinc-50">
            This Quick Word has ended.
          </p>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            It can&apos;t be rejoined or extended — that&apos;s the whole
            point.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Create a new one
          </Link>
        </div>
      ) : (
        <CallMedia room={room} mockMode={mockMode} joinUrl={joinUrl} />
      )}
    </>
  );
}
