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

import { useEffect, useRef } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

export default function CallMedia({
  room,
  mockMode,
  joinUrl,
  onParticipantCountChange,
}: {
  room: string;
  mockMode: boolean;
  joinUrl: string | null;
  /**
   * Called with the current number of participants in the room, any time it
   * changes. Not called at all in mock mode — there is no real Daily call to
   * wrap, so participant-based auto-start simply isn't available there (the
   * manual "Start now" button still works, since it doesn't depend on this).
   */
  onParticipantCountChange?: (count: number) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const callObjectRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    if (mockMode || !iframeRef.current) return;

    const callObject = DailyIframe.wrap(iframeRef.current);
    callObjectRef.current = callObject;

    const reportCount = () => {
      const participants = callObject.participants();
      onParticipantCountChange?.(Object.keys(participants).length);
    };

    callObject.on("joined-meeting", reportCount);
    callObject.on("participant-joined", reportCount);
    callObject.on("participant-left", reportCount);

    return () => {
      callObject.off("joined-meeting", reportCount);
      callObject.off("participant-joined", reportCount);
      callObject.off("participant-left", reportCount);
      // Don't call callObject.destroy() here: that would tear down the
      // embed's connection to the call. This effect's cleanup only needs to
      // stop listening — React unmounting the <iframe> itself (e.g. when
      // CallRoom swaps to the "ended" screen) is what actually ends the call.
      callObjectRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callObject is created fresh each time this effect runs; onParticipantCountChange is a stable callback from CallRoom's useCallback.
  }, [mockMode]);

  return (
    <>
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
