"use client";

// "Vote to end early" (ROADMAP.md, built 2026-07-22, nightly; ported into the
// call-object-mode UI the same day when /test was promoted to production).
// Headless — renders nothing, just keeps a live {votesToEnd, participantCount}
// tally in sync and reports it up to call-room.tsx, which owns the actual
// >50% threshold decision and the one-time call to
// `POST /api/rooms/[room]/end`.
//
// Same "no new datastore" principle as the rest of this app: the vote tally
// is never persisted anywhere. Every connected tab's own vote is broadcast to
// every other tab via daily-js's own app-message (a live WebRTC
// data-channel-backed broadcast scoped to this one call, gone the moment the
// call ends), and each tab keeps its own live tally by session ID, pruning
// any session ID that's no longer in the room. A late joiner is caught up by
// having every currently-"yes" tab re-broadcast its vote on
// `participant-joined`, since votes are otherwise only sent when they
// change, not on a schedule.
//
// This reads the same callObject the rest of the call-object-mode tree
// already has (via useDaily(), from the DailyProvider in call-room.tsx) and
// wires up daily-js's raw event listeners directly — the same proven
// mechanism the old iframe-based src/components/call-media.tsx used, just
// pointed at a call object this component didn't create.

import { useCallback, useEffect, useRef } from "react";
import { useDaily } from "@daily-co/daily-react";

export type VoteTally = {
  /** How many currently-present participants have voted to end the call. */
  votesToEnd: number;
  /** How many participants are currently in the room. */
  participantCount: number;
};

export default function CallEndVote({
  myVoteToEnd,
  onVoteTallyChange,
}: {
  /** This tab's own current vote, lifted up to call-room.tsx so it survives
   * this component re-rendering — toggled by the "End for everyone" button
   * rendered there. */
  myVoteToEnd: boolean;
  onVoteTallyChange: (tally: VoteTally) => void;
}) {
  const daily = useDaily();
  // session_id -> that participant's last-known vote. Purely in-memory, one
  // tab's own view of a live daily-js broadcast — never persisted, and reset
  // fresh any time this component (re)mounts for a new call.
  const voteMapRef = useRef<Map<string, boolean>>(new Map());
  const onVoteTallyChangeRef = useRef(onVoteTallyChange);
  useEffect(() => {
    onVoteTallyChangeRef.current = onVoteTallyChange;
  }, [onVoteTallyChange]);
  const myVoteToEndRef = useRef(myVoteToEnd);
  useEffect(() => {
    myVoteToEndRef.current = myVoteToEnd;
  }, [myVoteToEnd]);

  const recomputeTally = useCallback(() => {
    if (!daily) return;
    try {
      const participants = daily.participants();
      // Daily's own participants() shape includes the local participant
      // twice — once under the special "local" key, once under their own
      // session_id — so this de-dupes via a Set of session_ids before
      // counting, to avoid double-counting the local participant against the
      // >50% threshold.
      const presentIds = new Set(Object.values(participants).map((p) => p.session_id));
      for (const votedId of Array.from(voteMapRef.current.keys())) {
        if (!presentIds.has(votedId)) voteMapRef.current.delete(votedId);
      }
      let votesToEnd = 0;
      for (const id of presentIds) {
        if (voteMapRef.current.get(id) === true) votesToEnd += 1;
      }
      onVoteTallyChangeRef.current({ votesToEnd, participantCount: presentIds.size });
    } catch (err) {
      console.error("[Qwickword] Failed to recompute the end-call vote tally:", err);
    }
  }, [daily]);

  useEffect(() => {
    if (!daily) return;

    const handleAppMessage = (event: { data?: unknown; fromId?: string }) => {
      const data = event.data as { type?: string; vote?: boolean } | undefined;
      if (data?.type !== "qwickword-end-vote" || typeof event.fromId !== "string") return;
      voteMapRef.current.set(event.fromId, Boolean(data.vote));
      recomputeTally();
    };

    const handleParticipantJoined = () => {
      recomputeTally();
      if (myVoteToEndRef.current) {
        try {
          daily.sendAppMessage({ type: "qwickword-end-vote", vote: true }, "*");
        } catch (err) {
          console.error(
            "[Qwickword] Failed to re-broadcast end-call vote to a new joiner:",
            err
          );
        }
      }
    };

    const handleParticipantLeft = () => {
      recomputeTally();
    };

    daily.on("app-message", handleAppMessage);
    daily.on("participant-joined", handleParticipantJoined);
    daily.on("participant-left", handleParticipantLeft);
    recomputeTally();

    return () => {
      daily.off("app-message", handleAppMessage);
      daily.off("participant-joined", handleParticipantJoined);
      daily.off("participant-left", handleParticipantLeft);
    };
  }, [daily, recomputeTally]);

  // Broadcasts this tab's own vote to every other connected tab whenever it
  // changes (toggling the "End for everyone" button in call-room.tsx).
  useEffect(() => {
    if (!daily) return;
    try {
      const localId = daily.participants().local?.session_id;
      if (!localId) return;
      voteMapRef.current.set(localId, myVoteToEnd);
      daily.sendAppMessage({ type: "qwickword-end-vote", vote: myVoteToEnd }, "*");
      recomputeTally();
    } catch (err) {
      console.error("[Qwickword] Failed to broadcast this tab's end-call vote:", err);
    }
  }, [myVoteToEnd, daily, recomputeTally]);

  return null;
}
