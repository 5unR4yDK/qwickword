"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CallCountdown from "@/components/call-countdown";
import CallMedia, { type VoteTally } from "@/components/call-media";
import { formatDuration } from "@/lib/duration";

type Props = {
  room: string;
  /**
   * The room's current live `exp` (Unix seconds) as of the server's last
   * check — see src/app/[room]/page.tsx. Before the countdown has started,
   * this is the generous pre-start buffer, not the real call length.
   */
  exp: number;
  /**
   * The intended call length in seconds, from the link's `d` query param.
   * `null` for a link minted before this feature existed — those links have
   * no waiting state at all (see `initialStarted`'s doc below).
   */
  durationSeconds: number | null;
  /**
   * Whether the real countdown has already started, per the server's own
   * live check (src/lib/daily-rooms.ts's `isCountdownStarted`). `false` means
   * this page should show the waiting state below rather than a ticking
   * countdown, until a manual "Start now" click or a second participant
   * joining starts it.
   */
  initialStarted: boolean;
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
 * page's own persistent "Create your own Qwickword" footer link (rendered
 * one level up, in page.tsx's PageShell, unchanged by this component).
 *
 * "Anchor the countdown to first join, not link creation" (built 2026-07-21,
 * interactive): when `durationSeconds` is set and the countdown hasn't
 * started yet (`initialStarted: false`), this component shows a waiting
 * state instead of a ticking countdown — the call itself (CallMedia) still
 * renders, so people already in the pre-join lobby or call are genuinely
 * waiting together, not blocked from connecting. Two independent triggers
 * can start the real countdown, and whichever fires first wins:
 *  1. Manual: the "Start now" button below, visible to anyone on this page.
 *  2. Automatic: CallMedia's daily-js integration reports the live
 *     participant count from *inside the call itself* (no server needed for
 *     this one) — once it reaches 2, this component calls the same start
 *     endpoint on its own.
 * Both call `POST /api/rooms/[room]/start`, which is itself the thing that
 * decides "already started, no-op" vs. "start it now" (src/lib/daily-rooms.ts)
 * — so a race between the two triggers can't reset the clock.
 * A tab that's only waiting (hasn't triggered start itself) polls
 * `GET /api/rooms/[room]/status` every few seconds to pick up a start
 * triggered from a *different* tab — its own daily-js participant count is
 * only visible to tabs that are actually in the call.
 *
 * "Vote to end early" (ROADMAP.md, built 2026-07-22, nightly): the mirror
 * image of "Start now" — once `started`, an "End for everyone" button lets
 * anyone toggle their own vote; CallMedia reports back a live
 * `{votesToEnd, participantCount}` tally (daily-js app-message broadcasts
 * between tabs, no server involved — see call-media.tsx). The moment that
 * tally crosses a strict majority (`votesToEnd * 2 > participantCount` —
 * "over 50%," per Andreas's own phrasing, which is why exactly 2 of 2 is
 * required for two participants, not 1 of 2), this component calls
 * `POST /api/rooms/[room]/end` itself, exactly once (guarded the same way
 * `triggerStart` guards against double-firing). That endpoint sets the
 * room's real `exp` to right now, so the existing `isOver` swap below (built
 * for the original timer running out) handles the rest — ending a call
 * early reuses the exact same hard-end mechanism, just triggered sooner.
 */
export default function CallRoom({
  room,
  exp,
  durationSeconds,
  initialStarted,
  initialRemainingMs,
  mockMode,
  joinUrl,
}: Props) {
  const [currentExp, setCurrentExp] = useState<number>(exp);
  const [started, setStarted] = useState<boolean>(initialStarted);
  const [remainingMs, setRemainingMs] = useState<number>(initialRemainingMs);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Read inside callbacks without re-creating them on every render — see
  // triggerStart and handleParticipantCountChange below.
  const startedRef = useRef(started);
  useEffect(() => {
    startedRef.current = started;
  }, [started]);
  const startingRef = useRef(false);

  const triggerStart = useCallback(async () => {
    if (startingRef.current || startedRef.current || !durationSeconds) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch(`/api/rooms/${room}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't start the countdown."
        );
      }
      setCurrentExp(data.exp);
      setStarted(true);
    } catch (err) {
      setStartError(
        err instanceof Error ? err.message : "Couldn't start the countdown."
      );
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [room, durationSeconds]);

  const handleParticipantCountChange = useCallback(
    (count: number) => {
      if (count >= 2) void triggerStart();
    },
    [triggerStart]
  );

  // "Vote to end early" — see the doc comment above for the full mechanism.
  // myVoteToEnd is this tab's own vote, lifted up here (rather than living
  // inside CallMedia) so it survives CallMedia's own re-renders and so this
  // component can decide, in one place, when the live tally crosses the
  // threshold. voteTally is CallMedia's report of what it currently knows
  // from daily-js — not persisted, recomputed fresh every time it changes.
  const [myVoteToEnd, setMyVoteToEnd] = useState(false);
  const [voteTally, setVoteTally] = useState<VoteTally>({
    votesToEnd: 0,
    participantCount: 0,
  });
  const [endError, setEndError] = useState<string | null>(null);
  const endingRef = useRef(false);

  const triggerEnd = useCallback(async () => {
    // Guarded internally (same shape as triggerStart above) rather than by
    // the caller, so every call site — the majority check below, and mock
    // mode's direct "End call" button — shares one source of truth for
    // "is it valid to end this call right now." Ending only makes sense once
    // the countdown has actually started; there's nothing to cut short
    // before that.
    if (endingRef.current || !startedRef.current) return;
    endingRef.current = true;
    setEndError(null);
    try {
      const response = await fetch(`/api/rooms/${room}/end`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't end the call."
        );
      }
      setCurrentExp(data.exp);
      // Deliberately not resetting endingRef here: once the call has
      // actually been ended, there's nothing left to retry — the isOver
      // swap below takes over from the next tick of the countdown effect.
    } catch (err) {
      setEndError(err instanceof Error ? err.message : "Couldn't end the call.");
      // Allow a retry (e.g. a transient network blip) rather than
      // permanently wedging this tab's ability to end the call.
      endingRef.current = false;
    }
  }, [room]);

  // Receives CallMedia's live tally and, in the same callback (not a
  // separate effect watching voteTally — calling triggerEnd synchronously
  // from an effect body trips react-hooks/set-state-in-effect, since
  // triggerEnd itself sets state), fires the actual end the moment it
  // crosses a strict majority. Mirrors handleParticipantCountChange above,
  // which does the same "check the incoming value, call the trigger
  // directly" thing for starting rather than ending.
  const handleVoteTallyChange = useCallback(
    (tally: VoteTally) => {
      setVoteTally(tally);
      if (tally.participantCount > 0 && tally.votesToEnd * 2 > tally.participantCount) {
        void triggerEnd();
      }
    },
    [triggerEnd]
  );

  // Ticks the displayed remaining time off `currentExp`, which only changes
  // when the countdown actually starts (see triggerStart / the status-poll
  // effect below) — before that, `currentExp` is the generous pre-start
  // buffer, so this just idles at a large positive number, harmless since
  // the waiting UI is shown instead of this value while `!started`. Same
  // shape as the original single-`exp` version of this effect — setState
  // only happens inside the interval callback, never synchronously in the
  // effect body, so the display catches up within one tick (at most a
  // second) of `currentExp` changing rather than needing an extra
  // effect-body update, which `react-hooks/set-state-in-effect` flags.
  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(currentExp * 1000 - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [currentExp]);

  // Picks up a start triggered from a *different* tab (e.g. someone else in
  // the room pressed "Start now," or their tab detected the second join
  // before this one did). Not needed once `started` is true, for a link with
  // no duration (nothing to start), or in mock mode (no persisted room to
  // poll — see getRoomStatus's doc comment in src/lib/daily-rooms.ts).
  useEffect(() => {
    if (started || !durationSeconds || mockMode) return;
    const id = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/rooms/${room}/status?fallbackExp=${exp}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (data.started) {
          setCurrentExp(data.exp);
          setStarted(true);
        }
      } catch {
        // Transient — the next poll gets another chance.
      }
    }, 4000);
    return () => clearInterval(id);
  }, [started, durationSeconds, mockMode, room, exp]);

  const isOver = remainingMs <= 0;

  return (
    <>
      {started ? (
        <CallCountdown remainingMs={remainingMs} />
      ) : (
        <div role="status" className="flex flex-col items-center gap-1 text-center">
          <p className="text-2xl font-semibold text-black dark:text-zinc-50">
            Waiting to start
          </p>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            {durationSeconds
              ? `The ${formatDuration(durationSeconds)} countdown starts as soon as someone presses "Start now," or a second person joins.`
              : "Waiting for someone to join."}
          </p>
        </div>
      )}

      {isOver ? (
        <div
          role="status"
          className="flex w-full max-w-3xl flex-col items-center gap-3 rounded-2xl border border-black/[.08] bg-white px-6 py-16 text-center dark:border-white/[.145] dark:bg-zinc-950"
        >
          <p className="text-lg font-medium text-black dark:text-zinc-50">
            This Qwickword has ended.
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
        <>
          <CallMedia
            room={room}
            mockMode={mockMode}
            joinUrl={joinUrl}
            myVoteToEnd={myVoteToEnd}
            onParticipantCountChange={handleParticipantCountChange}
            onVoteTallyChange={handleVoteTallyChange}
          />

          {!started && durationSeconds && (
            <button
              type="button"
              onClick={() => void triggerStart()}
              disabled={starting}
              className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {starting ? "Starting…" : "Start now"}
            </button>
          )}

          {startError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {startError}
            </p>
          )}

          {started && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  // Mock mode has no real daily-js call to tally votes over
                  // (same limitation documented on CallMedia's
                  // onParticipantCountChange) — there's no one else who
                  // could be voting, so a click here just ends the (mock)
                  // call directly rather than toggling a vote that can never
                  // reach a real tally.
                  if (mockMode) {
                    void triggerEnd();
                    return;
                  }
                  setMyVoteToEnd((prev) => !prev);
                }}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                  myVoteToEnd
                    ? "border-transparent bg-rose-600 text-white hover:bg-rose-700"
                    : "border-black/[.15] bg-transparent text-black hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
                }`}
              >
                {mockMode
                  ? "End call"
                  : myVoteToEnd
                    ? "Cancel end vote"
                    : "End for everyone"}
              </button>
              {!mockMode && voteTally.participantCount > 1 && (
                <p
                  role="status"
                  className="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  {voteTally.votesToEnd} of {voteTally.participantCount} want to
                  end early
                </p>
              )}
            </div>
          )}

          {endError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {endError}
            </p>
          )}
        </>
      )}
    </>
  );
}
