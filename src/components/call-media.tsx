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

    const reportCount = () => {
      try {
        const participants = callObject!.participants();
        onParticipantCountChange?.(Object.keys(participants).length);
      } catch (err) {
        console.error("[Qwickword] Failed to read participant count:", err);
      }
    };

    callObject.on("joined-meeting", reportCount);
    callObject.on("participant-joined", reportCount);
    callObject.on("participant-left", reportCount);

    return () => {
      callObject!.off("joined-meeting", reportCount);
      callObject!.off("participant-joined", reportCount);
      callObject!.off("participant-left", reportCount);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callObject is created fresh each time this effect runs; onParticipantCountChange is a stable callback from CallRoom's useCallback.
  }, [mockMode]);

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
        className="h-[70vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-black/[.08] bg-black sm:aspect-video sm:h-auto dark:border-white/[.145]"
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
