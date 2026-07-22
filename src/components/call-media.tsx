"use client";

// The call area: a Daily iframe (live mode) or a placeholder box (mock mode),
// plus the "open in new tab" fallback link. Pulled out as its own component
// (Phase 0 item 6, "Hard-end experience") because it now needs to be rendered
// from two places that must stay in sync: the call page's normal timed path
// (CallRoom, which unmounts this entirely once the countdown hits zero — see
// call-room.tsx for why that matters) and the "missing/invalid exp" fallback
// in page.tsx, which has no known expiry to drive a hard-end swap yet
// (that fallback becomes a real friendly screen in the next roadmap item,
// "Invalid/expired-link handling").
//
// Phase 1 item 1 ("Pre-join screen"): the live-mode iframe below now points at
// a room created with `enable_prejoin_ui: true` (src/lib/daily-rooms.ts), so
// Daily Prebuilt itself shows a lobby — name entry, camera/mic check — before
// the participant actually joins. No new component was needed for live mode;
// this file's only change is a short explanatory note in the mock-mode box
// below, since there is no real Daily embed to show a lobby inside.
//
// "Anchor the countdown to first join, not link creation" (built 2026-07-21,
// interactive): this became a Client Component so it can wrap the iframe with
// daily-js (`@daily-co/daily-js`, via `DailyIframe.wrap()` — this keeps
// Daily Prebuilt's own UI, including the pre-join lobby above, rather than
// swapping in a custom call surface). `DailyIframe.wrap()` attaches to the
// existing iframe rather than replacing it, so the embed still looks and
// behaves exactly as before; the only difference is this component can now
// listen for participant events. It reports live participant counts up to
// CallRoom via `onParticipantCountChange`, which is what lets *every*
// connected tab detect "a second person has joined" independently, with no
// server involved — see call-room.tsx for what it does with that count.
//
// Corrected 2026-07-21, same day (Andreas, interactive, reported "Join the
// meeting now" occasionally showing a browser-level crash page): the effect
// below originally didn't call callObject.destroy() on cleanup, assuming
// React unmounting the <iframe> was enough to end the call. It is, but
// daily-js additionally enforces a page-wide singleton — only one DailyCall
// instance may exist at a time — and that instance survives the DOM node's
// removal if never destroyed. In a client-routed SPA (no full page reload
// between navigations), that meant a *second* call to DailyIframe.wrap()
// later in the same tab could throw "Duplicate DailyIframe instances are not
// supported," and with no error boundary anywhere in the app at the time,
// that uncaught exception surfaced as the browser's own generic crash page
// instead of anything from this app. Fixed both ends: destroy() now actually
// runs on cleanup, and src/app/error.tsx was added the same day as a safety
// net for any future uncaught render error, daily-js-related or not.
//
// "Vote to end early" (ROADMAP.md, built 2026-07-22, nightly): the mirror
// image of the join-detection above — where that reports "how many people
// are here" up to CallRoom, this reports "how many of them want to end the
// call early." Same "no new datastore" principle as the rest of this app:
// the vote tally is never persisted anywhere. Instead, every connected tab's
// own vote is broadcast to every other tab via daily-js's own
// `sendAppMessage` (a live WebRTC data-channel-backed broadcast scoped to
// this one call, gone the moment the call ends — exactly the lifetime a vote
// should have), and each tab keeps its own live tally by session ID,
// pruning any session ID that's no longer in the room (someone who left
// obviously can't still be counted as a "yes"). A late joiner is caught up
// by having every currently-"yes" tab re-broadcast its vote on
// `participant-joined`, since votes are otherwise only sent when they
// change, not on a schedule. CallRoom (src/components/call-room.tsx) owns
// the actual >50% threshold decision and the one-time call to
// `POST /api/rooms/[room]/end` — this component's job stops at reporting an
// accurate, live `{votesToEnd, participantCount}` tally.

import { useEffect, useRef } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

export type VoteTally = {
  /** How many currently-present participants have voted to end the call. */
  votesToEnd: number;
  /** How many participants are currently in the room. */
  participantCount: number;
};

export default function CallMedia({
  room,
  mockMode,
  joinUrl,
  myVoteToEnd = false,
  onParticipantCountChange,
  onVoteTallyChange,
  onLeftMeeting,
}: {
  room: string;
  mockMode: boolean;
  joinUrl: string | null;
  /**
   * This tab's own current vote ("do I want to end the call early?"),
   * lifted up to CallRoom so it survives this component re-rendering.
   * Broadcast to every other connected tab whenever it changes — see the
   * effect below. Ignored (no-op) in mock mode, same as
   * onParticipantCountChange, since there's no real daily-js call to
   * broadcast over.
   */
  myVoteToEnd?: boolean;
  /**
   * Called with the current number of participants in the room, any time it
   * changes. Not called at all in mock mode — there is no real Daily call to
   * wrap, so participant-based auto-start simply isn't available there (the
   * manual "Start now" button still works, since it doesn't depend on this).
   */
  onParticipantCountChange?: (count: number) => void;
  /**
   * Called with this tab's live view of the end-early vote, any time it
   * changes (a vote broadcast arrives, or the participant list changes).
   * Not called in mock mode — see onParticipantCountChange's doc above for
   * why.
   */
  onVoteTallyChange?: (tally: VoteTally) => void;
  /**
   * Called once this tab's own local participant has left the call —
   * daily-js's `left-meeting` event, fired when *this* browser leaves
   * (clicking Daily Prebuilt's own "Leave" control inside the iframe, or any
   * other reason this tab disconnects). Added 2026-07-22 (Andreas,
   * interactive: "the timer also should go away after we have left the
   * call, no more countdown") — this is what lets CallRoom stop showing a
   * countdown for a call this tab isn't in anymore, independent of whether
   * the room itself is still running for anyone else. Not called in mock
   * mode — there is no real daily-js call to leave.
   */
  onLeftMeeting?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const callObjectRef = useRef<DailyCall | null>(null);
  // session_id -> that participant's last-known vote. Purely in-memory, one
  // tab's own view of a live daily-js broadcast — never persisted, and reset
  // to empty on every fresh call connection (a new call has no carried-over
  // votes from whatever call happened to use this room before).
  const voteMapRef = useRef<Map<string, boolean>>(new Map());
  // Latest onVoteTallyChange/myVoteToEnd, readable from inside the
  // long-lived effect below without needing that effect to re-run (which
  // would tear down and recreate the daily-js call object) — same ref-sync
  // pattern call-room.tsx already uses for startedRef.
  const onVoteTallyChangeRef = useRef(onVoteTallyChange);
  useEffect(() => {
    onVoteTallyChangeRef.current = onVoteTallyChange;
  }, [onVoteTallyChange]);
  const myVoteToEndRef = useRef(myVoteToEnd);
  useEffect(() => {
    myVoteToEndRef.current = myVoteToEnd;
  }, [myVoteToEnd]);

  useEffect(() => {
    if (mockMode || !iframeRef.current) return;

    // daily-js only allows one DailyCall instance to exist on a page at a
    // time — calling DailyIframe.wrap() a second time before the first
    // instance is destroyed throws ("Duplicate DailyIframe instances are not
    // supported"). That's a real risk in a client-routed SPA: this effect's
    // cleanup used to skip destroy() entirely (see the corrected note
    // below), which left a previous call object alive across client-side
    // navigations (e.g. "Create a new one" → straight back into a new call
    // in the same tab), so the *next* mount's wrap() call could throw — an
    // uncaught exception with no error boundary in place (fixed by
    // src/app/error.tsx, added the same day this was found) would surface as
    // the browser's own generic crash page instead of anything from this
    // app. Wrapping wrap() itself in try/catch, and actually destroying the
    // call object on cleanup, closes both the immediate crash risk and the
    // root cause.
    let callObject: DailyCall | null = null;
    try {
      callObject = DailyIframe.wrap(iframeRef.current);
    } catch (err) {
      console.error("[Qwickword] Failed to wrap the call iframe with daily-js:", err);
      return;
    }
    callObjectRef.current = callObject;
    voteMapRef.current = new Map();

    const reportCount = () => {
      try {
        const participants = callObject!.participants();
        onParticipantCountChange?.(Object.keys(participants).length);
      } catch (err) {
        console.error("[Qwickword] Failed to read participant count:", err);
      }
    };

    // Recomputes this tab's own end-vote tally from voteMapRef against who's
    // currently actually in the room — see the "Vote to end early" note atop
    // this file for why the tally is never persisted anywhere beyond that
    // map and this recompute.
    const recomputeTally = () => {
      try {
        const participants = callObject!.participants();
        // Daily's own participants() shape includes the local participant
        // twice — once under the special "local" key, once under their own
        // session_id (see DailyParticipantsObject in @daily-co/daily-js) —
        // so this de-dupes via a Set of session_ids before counting, rather
        // than counting Object.values() entries directly, to avoid
        // double-counting the local participant against the >50% threshold.
        const presentIds = new Set(
          Object.values(participants).map((p) => p.session_id)
        );
        for (const votedId of Array.from(voteMapRef.current.keys())) {
          if (!presentIds.has(votedId)) voteMapRef.current.delete(votedId);
        }
        let votesToEnd = 0;
        for (const id of presentIds) {
          if (voteMapRef.current.get(id) === true) votesToEnd += 1;
        }
        onVoteTallyChangeRef.current?.({
          votesToEnd,
          participantCount: presentIds.size,
        });
      } catch (err) {
        console.error("[Qwickword] Failed to recompute the end-call vote tally:", err);
      }
    };

    const handleAppMessage = (event: { data?: unknown; fromId?: string }) => {
      const data = event.data as { type?: string; vote?: boolean } | undefined;
      if (data?.type !== "qwickword-end-vote" || typeof event.fromId !== "string") {
        return;
      }
      voteMapRef.current.set(event.fromId, Boolean(data.vote));
      recomputeTally();
    };

    const handleParticipantJoined = () => {
      reportCount();
      recomputeTally();
      // Votes are only broadcast when they change, not on a schedule, so a
      // newcomer wouldn't otherwise learn about a vote cast before they
      // joined — every tab that's currently voting "yes" re-announces it
      // whenever someone new arrives.
      if (myVoteToEndRef.current) {
        try {
          callObject!.sendAppMessage(
            { type: "qwickword-end-vote", vote: true },
            "*"
          );
        } catch (err) {
          console.error("[Qwickword] Failed to re-broadcast end-call vote to a new joiner:", err);
        }
      }
    };

    const handleParticipantLeft = () => {
      reportCount();
      recomputeTally();
    };

    // "the timer also should go away after we have left the call, no more
    // countdown" (2026-07-22, Andreas, interactive). daily-js's own
    // `left-meeting` event fires specifically for the LOCAL participant
    // leaving — distinct from `participant-left` above, which fires for
    // *other* participants leaving (and is what feeds the vote tally/
    // participant count, still relevant to everyone else in the room).
    // Wrapped in try/catch like every other daily-js callback in this file,
    // even though there's nothing here that can meaningfully throw — kept
    // for consistency with the rest of the file's defensive style.
    const handleLeftMeeting = () => {
      try {
        onLeftMeeting?.();
      } catch (err) {
        console.error("[Qwickword] onLeftMeeting callback failed:", err);
      }
    };

    callObject.on("joined-meeting", reportCount);
    callObject.on("participant-joined", handleParticipantJoined);
    callObject.on("participant-left", handleParticipantLeft);
    callObject.on("app-message", handleAppMessage);
    callObject.on("left-meeting", handleLeftMeeting);

    // Backstop poll (added 2026-07-22, Andreas, interactive: reported a call
    // where the countdown didn't auto-start when his friend joined — he had
    // to press "Start now" manually). The event-driven path above
    // ("participant-joined" -> reportCount) should be sufficient on its own,
    // but it depends on daily-js reliably firing that event and this tab's
    // JS timer loop staying responsive to react to it; a backgrounded/
    // throttled browser tab, or any daily-js event-delivery hiccup, would
    // silently mean the auto-start never fires with no way to tell from the
    // UI that anything went wrong (the manual "Start now" button is the only
    // sign anything's off). Since a two-participant Qwickword call is short
    // and this is the mechanism the whole "anchor countdown to first join"
    // feature depends on, this adds a periodic direct read of
    // `participants()` as a second, independent path to the same
    // `reportCount`/`recomputeTally` calls — not relying on any single event
    // firing correctly. Cheap (participants() is a local, synchronous read,
    // no network call) and idempotent (reportCount/recomputeTally are safe
    // to call redundantly).
    //
    // Extended the same day (Andreas, interactive: "Its still counting down
    // after I leave the call. the countdown should disappear after I leave
    // the call") — the `left-meeting` event listener above was already in
    // place and confirmed live in the deployed bundle, but didn't fire for
    // him in practice: the countdown and "End for everyone" controls kept
    // rendering even after Daily Prebuilt's own UI showed its "You've left
    // the call" screen. Same shape of problem as the auto-start bug above —
    // an event this feature depends on isn't reliably reaching this
    // listener — so the same fix applies: stop trusting the event alone and
    // also poll daily-js's own authoritative `meetingState()` directly.
    // `hasReportedLeftRef` makes this a one-shot signal even though the poll
    // itself repeats every 2s (once the local participant has left, calling
    // `onLeftMeeting` again on every subsequent tick would be redundant, not
    // harmful, but there's no reason to keep doing it).
    const hasReportedLeftRef = { current: false };
    const backstopIntervalId = setInterval(() => {
      reportCount();
      recomputeTally();
      if (!hasReportedLeftRef.current) {
        try {
          const state = callObject!.meetingState();
          if (state === "left-meeting" || state === "error") {
            hasReportedLeftRef.current = true;
            handleLeftMeeting();
          }
        } catch (err) {
          console.error("[Qwickword] Failed to read meetingState() in the backstop poll:", err);
        }
      }
    }, 2000);

    return () => {
      callObject!.off("joined-meeting", reportCount);
      callObject!.off("participant-joined", handleParticipantJoined);
      callObject!.off("participant-left", handleParticipantLeft);
      callObject!.off("app-message", handleAppMessage);
      callObject!.off("left-meeting", handleLeftMeeting);
      clearInterval(backstopIntervalId);
      // Corrected 2026-07-21: this used to skip destroy() on the assumption
      // that removing the <iframe> from the DOM was enough to end the call.
      // That's true for the call itself, but daily-js's own call-object
      // singleton survives the DOM node's removal — leaving it alive is what
      // makes the *next* wrap() call on this page throw. destroy() is wrapped
      // in try/catch since it can itself reject/throw if the call was never
      // fully connected.
      try {
        callObject!.destroy();
      } catch (err) {
        console.error("[Qwickword] Failed to destroy the daily-js call object:", err);
      }
      callObjectRef.current = null;
      voteMapRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callObject is created fresh each time this effect runs; onParticipantCountChange is a stable callback from CallRoom's useCallback; myVoteToEnd/onVoteTallyChange are read via refs above so this effect doesn't need to re-run when they change.
  }, [mockMode]);

  // Broadcasts this tab's own vote to every other connected tab whenever it
  // changes (toggling the "End for everyone" button in CallRoom). Separate
  // from the connection-setup effect above so casting/retracting a vote
  // never tears down and recreates the daily-js call object — it just reads
  // the same long-lived callObjectRef.
  useEffect(() => {
    const callObject = callObjectRef.current;
    if (mockMode || !callObject) return;
    try {
      const localId = callObject.participants().local?.session_id;
      if (!localId) return;
      voteMapRef.current.set(localId, myVoteToEnd);
      callObject.sendAppMessage(
        { type: "qwickword-end-vote", vote: myVoteToEnd },
        "*"
      );
      // De-duped the same way as recomputeTally above — see its comment for
      // why (the local participant otherwise appears twice in participants()).
      const presentIds = new Set(
        Object.values(callObject.participants()).map((p) => p.session_id)
      );
      let votesToEnd = 0;
      for (const id of presentIds) {
        if (voteMapRef.current.get(id) === true) votesToEnd += 1;
      }
      onVoteTallyChangeRef.current?.({
        votesToEnd,
        participantCount: presentIds.size,
      });
    } catch (err) {
      console.error("[Qwickword] Failed to broadcast this tab's end-call vote:", err);
    }
  }, [myVoteToEnd, mockMode]);

  return (
    <>
      <div
        // Enlarged 2026-07-21 (Andreas, interactive: "the conference call
        // video window was quite small compared to... Google Meet or
        // Teams"). Two changes: a much wider max-width for desktop (max-w-3xl
        // -> max-w-6xl), and on mobile, no forced 16:9 landscape shape — a
        // 16:9 box on a narrow portrait phone viewport is a short, wide
        // strip with lots of empty space above/below, which is almost
        // certainly what his friend on mobile meant by "cropped." Below the
        // `sm` breakpoint this uses `h-[70vh]` (fills most of the phone's
        // screen, whatever shape that ends up being) instead of a fixed
        // aspect ratio; at `sm` and up it switches to the classic 16:9 video
        // shape, since a wide desktop window is exactly where that shape
        // makes sense. Daily Prebuilt's own UI inside the iframe is already
        // responsive to whatever box it's given — this only changes the box.
        //
        // Enlarged again 2026-07-22 (Andreas, interactive, comparing a
        // screenshot against Google Meet: "notice how small our window is...
        // Why can't we be as big?"). The `max-w-6xl` (1152px) cap was the
        // culprit — on any monitor wider than that (most desktops), it left
        // a large gap on either side that Meet, which stretches to fill the
        // browser window, doesn't have.
        //
        // Corrected the same day, still 2026-07-22 (Andreas, interactive:
        // "making the window larger introduced a new UI bug. we get a window
        // that doesn't fit the browser"). The first fix (`w-full` +
        // `sm:aspect-video` + `sm:h-auto` + `sm:max-w-none`) drove the box's
        // WIDTH from the browser window and let height follow the 16:9
        // ratio — on any monitor much wider than it is tall, that produces a
        // box taller than the viewport (e.g. a 2500px-wide window makes a
        // ~1400px-tall box), pushing Daily Prebuilt's pre-join card down
        // past the fold and forcing a page scroll just to see it. Flipped
        // which dimension drives the ratio: HEIGHT is now fixed at `70vh`
        // (guaranteed to fit the viewport by construction) and width follows
        // the 16:9 ratio from that, capped at `sm:max-w-full` so it still
        // shrinks to fit on any window too narrow for a full 16:9 box at
        // that height — same "as big as Meet, but never bigger than the
        // screen" goal, just measured from the dimension that was actually
        // overflowing.
        className="mx-auto h-[70vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-black/[.08] bg-black sm:aspect-video sm:w-auto sm:max-w-full dark:border-white/[.145]"
      >
        {mockMode ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-300">
            <p className="text-base font-medium">
              Mock call — no Daily API key configured
            </p>
            <p className="text-sm text-zinc-400">Room: {room}</p>
            <p className="max-w-xs text-xs text-zinc-500">
              In live mode, this box is a real call and opens on Daily&apos;s
              own pre-join lobby first — enter your name, check your camera
              and mic, then join.
            </p>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={joinUrl ?? undefined}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-full w-full border-0"
            title="Qwickword call"
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
    </>
  );
}
