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

  // "the timer also should go away after we have left the call, no more
  // countdown" (2026-07-22, Andreas, interactive). Set once CallMedia
  // reports daily-js's `left-meeting` event for this tab's own local
  // participant — see the render below, which swaps to a dedicated "left"
  // screen in place of the countdown/call area entirely once this is true,
  // regardless of whether the room's own timer (`isOver`) has actually run
  // out yet. Deliberately separate from `isOver`: leaving early is a
  // per-tab, personal thing (the call may well still be running for anyone
  // else left in it), not the room-wide hard end that `isOver` represents.
  const [hasLeft, setHasLeft] = useState(false);
  const handleLeftMeeting = useCallback(() => setHasLeft(true), []);

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

  // Ticks the displayed remaining time off `currentExp`. Fixed 2026-07-22
  // (Andreas, interactive: "when I start the meeting the first seconds
  // shows something like 1400.56 seconds"): this used to *only* recompute
  // on a once-a-second `setInterval`, which doesn't fire the instant
  // `currentExp` itself changes (e.g. the moment "Start now"/join-triggered
  // auto-start flips `started` true and swaps `currentExp` from the ~24h
  // pre-start buffer to the real countdown) — only on its own next tick, up
  // to ~1000ms later. That gap meant `CallCountdown` could already be
  // rendering (`started` had flipped) while `remainingMs` still held its
  // last *pre-start-buffer* value — tens of thousands of seconds, which
  // `formatRemaining`'s M:SS display renders as something like "1400:56"
  // (1400 minutes), exactly what was reported. Fixed by also firing an
  // immediate recompute via a zero-delay `setTimeout` alongside the regular
  // interval, closing the gap to effectively the next event-loop tick
  // instead of up to a full second. Both the timeout and the interval call
  // `setRemainingMs` from inside their own callbacks, not synchronously in
  // the effect body itself, which is what keeps this clear of
  // `react-hooks/set-state-in-effect` (that rule targets setState calls
  // that happen unconditionally and synchronously as the effect runs, not
  // ones deferred into a callback like these).
  useEffect(() => {
    const tick = () => setRemainingMs(currentExp * 1000 - Date.now());
    const immediateId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediateId);
      clearInterval(intervalId);
    };
  }, [currentExp]);

  // Picks up a start triggered from a *different* tab (e.g. someone else in
  // the room pressed "Start now," or their tab detected the second join
  // before this one did) — AND, as of 2026-07-22 (Andreas, interactive, live
  // bug: countdown not auto-starting when a second person joined from
  // mobile, "the second time I've seen it"), now also carries
  // `durationSeconds` so the status route itself can auto-start the room
  // server-side once Daily's own presence count hits 2, independent of
  // whether any tab's own daily-js `participant-joined` detection worked —
  // see the doc comment on /api/rooms/[room]/status/route.ts for why that
  // client-only path wasn't reliable enough on its own. Not needed once
  // `started` is true, for a link with no duration (nothing to start), or in
  // mock mode (no persisted room to poll — see getRoomStatus's doc comment
  // in src/lib/daily-rooms.ts).
  useEffect(() => {
    if (started || !durationSeconds || mockMode) return;
    const id = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/rooms/${room}/status?fallbackExp=${exp}&durationSeconds=${durationSeconds}`
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

  // Periodically re-syncs `currentExp` against Daily's own live room status
  // once the countdown has actually started (added 2026-07-22, Andreas,
  // interactive: reported a call ending "2 seconds early" — i.e. Daily's own
  // server-side `eject_at_room_exp` enforcement cut the call slightly before
  // this page's own display reached 0:00). This page's countdown is driven
  // entirely by the CLIENT's own clock (`currentExp * 1000 - Date.now()`),
  // while Daily enforces the cutoff on ITS OWN clock — any skew between the
  // two (typical device clock drift, or latency in when this tab first
  // learned the real `exp`) means the two can disagree by a second or two,
  // and there's no way to fully eliminate that without a full clock-sync
  // protocol. What this *can* do cheaply: periodically ask Daily itself
  // (via the same `getRoomStatus` this page already uses for the waiting
  // poll above) what `exp` really is right now, and correct `currentExp` if
  // it's drifted, so a long-running countdown keeps re-anchoring to the
  // authoritative source rather than compounding client-clock drift over the
  // full length of the call. Every 10s is frequent enough to catch drift
  // well before it becomes visible, without being as chatty as the 4s
  // waiting-poll (which needs to be snappier since a human is actively
  // waiting on it). Skipped in mock mode — no persisted room to poll (see
  // getRoomStatus's doc comment in src/lib/daily-rooms.ts).
  // Extended 2026-07-22 (Andreas, interactive, live bug: after leaving a
  // call, the page kept showing "Waiting to start"/"Start now" instead of
  // the left-call screen, even though Daily's own iframe UI had already
  // shown "You've left the call" — meaning both the `left-meeting` event
  // AND CallMedia's own 2s `meetingState()` backstop poll failed to report
  // it for that tab. Same root problem as the auto-start bug above: every
  // signal this depended on came from that one tab's own daily-js bridge.
  // This resync poll already asks Daily directly for this room's live `exp`
  // every 10s — it now also reads `presentCount` from the same response
  // (Daily's own `/rooms/:name/presence`, computed server-side, nothing to
  // do with this tab's daily-js state at all). If Daily reports NOBODY
  // currently present, this tab can't still be genuinely connected either,
  // whatever its own (apparently unreliable, in this report) local
  // leave-detection thinks — `emptyPollStreakRef` requires two consecutive
  // 0-counts (20s) before acting, so a single transient/propagation-delay
  // reading right after joining can't cause a false positive.
  const emptyPollStreakRef = useRef(0);
  useEffect(() => {
    if (!started || mockMode) return;
    const id = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/rooms/${room}/status?fallbackExp=${currentExp}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data.exp === "number" && data.exp !== currentExp) {
          setCurrentExp(data.exp);
        }
        if (data.presentCount === 0) {
          emptyPollStreakRef.current += 1;
          if (emptyPollStreakRef.current >= 2) {
            setHasLeft(true);
          }
        } else {
          emptyPollStreakRef.current = 0;
        }
      } catch {
        // Transient — the next poll gets another chance; worst case the
        // display keeps running on its last-known `exp` until then, same as
        // if this resync didn't exist at all.
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [started, mockMode, room, currentExp]);

  const isOver = remainingMs <= 0;

  return (
    <>
      {hasLeft ? (
        // "the timer also should go away after we have left the call, no
        // more countdown" (2026-07-22, Andreas, interactive). Replaces
        // *everything* below (countdown/waiting text, call area, all the
        // buttons) the moment this tab's own local participant leaves —
        // deliberately doesn't say the Qwickword itself has ended, since
        // from this tab's own leave, it might still be running for whoever
        // else is left in it.
        <div
          role="status"
          className="flex w-full max-w-3xl flex-col items-center gap-3 rounded-2xl border border-black/[.08] bg-white px-6 py-16 text-center dark:border-white/[.145] dark:bg-zinc-950"
        >
          <p className="text-lg font-medium text-black dark:text-zinc-50">
            You&apos;ve left this call.
          </p>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            It may still be running for anyone else still in it — there&apos;s
            no way back into this one.
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
                onLeftMeeting={handleLeftMeeting}
              />

              {!started && durationSeconds && (
                <button
                  type="button"
                  onClick={() => void triggerStart()}
                  disabled={starting}
                  className="cursor-pointer rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
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
                      // Mock mode has no real daily-js call to tally votes
                      // over (same limitation documented on CallMedia's
                      // onParticipantCountChange) — there's no one else who
                      // could be voting, so a click here just ends the
                      // (mock) call directly rather than toggling a vote
                      // that can never reach a real tally.
                      if (mockMode) {
                        void triggerEnd();
                        return;
                      }
                      setMyVoteToEnd((prev) => !prev);
                    }}
                    className={`cursor-pointer rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
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
                      {voteTally.votesToEnd} of {voteTally.participantCount}{" "}
                      want to end early
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
      )}
    </>
  );
}
