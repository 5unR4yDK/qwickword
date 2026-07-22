"use client";

// v2 call UI preview — CALL_UI_REBUILD_SPEC.md, section 2 ("Video is the
// entire canvas") and section 3b. Full-bleed remote video, self-view as a
// small corner PIP — the Google Meet convention this whole rebuild is
// chasing, in place of Daily Prebuilt's boxed video tiles.
//
// Qwickword is two-participant by design (CALL_UI_REBUILD_SPEC.md section 6,
// "out of scope": more than two participants isn't designed for here), so
// this only ever renders one remote tile — no grid logic needed yet.

import { DailyVideo, useLocalSessionId, useParticipantIds } from "@daily-co/daily-react";

export default function CallVideoGrid() {
  const localSessionId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: "remote" });
  const remoteId = remoteIds[0];

  return (
    <div className="absolute inset-0 bg-black">
      {remoteId ? (
        <DailyVideo
          automirror
          fit="cover"
          sessionId={remoteId}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-zinc-500">
          Waiting for someone else to join…
        </div>
      )}

      {localSessionId && (
        <div className="absolute bottom-24 right-4 h-28 w-20 overflow-hidden rounded-xl border border-white/15 shadow-lg sm:bottom-28 sm:h-40 sm:w-28">
          <DailyVideo
            automirror
            fit="cover"
            sessionId={localSessionId}
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
