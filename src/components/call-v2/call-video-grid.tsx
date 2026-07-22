"use client";

// v2 call UI preview — CALL_UI_REBUILD_SPEC.md, section 2 ("Video is the
// entire canvas") and section 3b. Full-bleed video, self-view as a small
// corner PIP — the Google Meet convention this rebuild chases.
//
// Extended 2026-07-22 (Andreas, interactive, after trying the first version
// solo): "for the self view it should be possible to pin myself so that I
// just see myself because at the moment it was impossible for me to see how
// big the screen actually was... unless I had someone else join the call
// which I can't when I'm just testing." Two changes:
//  1. When nobody else is in the call, the local participant is now the
//     MAIN tile automatically (not a tiny corner PIP next to an empty
//     "waiting" placeholder) — solves the actual problem (judging the
//     video's real size) without needing a second person at all.
//  2. An explicit pin control: click the small PIP tile's pin icon to swap
//     it into the main position; the main tile then shows an "unpin" icon
//     to go back to automatic (remote-takes-main-if-present) layout.
// Also added: the small PIP tile is now draggable (pointer events, clamped
// to the video container's bounds) instead of fixed in the bottom-right
// corner where Andreas found it "very close to the edge of the browser" and
// un-movable. And: a camera-off state now shows a generic avatar circle
// instead of plain black, so it's visually clear someone's still there with
// their camera off, not that the video failed — Andreas: "there's no
// monogram or any indication... I think there has to be something to
// indicate that it's just the video is off."
//
// Screen share (Andreas: "we also need to be able to share screen like in
// Google Meet"): when either participant is sharing, the shared screen
// takes over the main tile (Meet's own convention — screen share always
// gets the spotlight), and both camera feeds drop to a small tile strip.
// Toggling share itself lives in call-controls.tsx (useScreenShare's
// startScreenShare/stopScreenShare) — this component only renders whatever
// useScreenShare reports.
//
// Never crop a camera feed (2026-07-22, Andreas, interactive, after a real
// two-tab test — phone joining a desktop call): every DailyVideo below used
// `fit="cover"`, which fills its box by CROPPING whatever doesn't fit the
// box's own aspect ratio. Andreas caught the real consequence of that
// live: "the larger I made the window... the more it seemed to zoom in on
// my face... the smaller I made the browser window, the more was being
// included from the phone feed." That's cover working as designed, not a
// bug in the usual sense — a wide desktop window is a very different shape
// from a phone's portrait camera feed, and cover crops harder the further
// those two shapes diverge, so resizing the window changed how much got
// cropped away. His call: "we should never be cropping the image... we'd
// rather want to maximize the image inside of the available frame." Every
// DailyVideo in this file now uses `fit="contain"` instead — the full
// camera frame is always visible, letterboxed (black bars, matching each
// tile's own bg-black) on whichever dimension doesn't match, rather than
// ever cutting part of the picture off. Applies uniformly to the main tile,
// the PIP, and the screen-share camera strip — "that goes both on the phone
// and it goes also on the desktop."

import { useCallback, useRef, useState } from "react";
import { Pin, PinOff, User } from "lucide-react";
import {
  DailyVideo,
  useLocalSessionId,
  useParticipantIds,
  useScreenShare,
  useVideoTrack,
} from "@daily-co/daily-react";

type Offset = { x: number; y: number };

const ZERO_OFFSET: Offset = { x: 0, y: 0 };

/** Generic silhouette shown in place of video when a camera track is off. */
function AvatarFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-800">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
        <User size={24} />
      </div>
    </div>
  );
}

/** Full-bleed main tile — either a camera feed or a screen share. */
function MainTile({
  sessionId,
  type,
  canUnpin,
  onUnpin,
}: {
  sessionId: string;
  type: "video" | "screenVideo";
  canUnpin: boolean;
  onUnpin: () => void;
}) {
  // useVideoTrack only covers the 'video' track type; a screen share needs
  // its own read since it's a different track — but only the camera case
  // needs an off/avatar fallback (a screen share track is never "off," it's
  // either present or not shared at all).
  const cameraTrack = useVideoTrack(type === "video" ? sessionId : "");
  const showAvatar = type === "video" && cameraTrack.isOff;

  return (
    <div className="absolute inset-0 bg-black">
      {showAvatar ? (
        <AvatarFallback />
      ) : (
        // fit="contain" (was "cover") — 2026-07-22, Andreas, interactive:
        // "we should never be cropping the image... maximize it as far as
        // we can inside of the canonical architecture... it's OK if
        // there're empty spaces out on the right and on the left." Also
        // explains the "the larger I made the window the more it seemed to
        // zoom in on my face" report: object-fit: cover crops MORE as the
        // container's aspect ratio diverges further from the source
        // video's — a wide desktop window vs. a portrait phone feed is
        // exactly that divergence, so making the window wider kept cropping
        // tighter around the middle of the frame. `contain` never crops at
        // all, at any container shape — it letterboxes (shows black bars,
        // matching this tile's own bg-black) instead, so the full webcam
        // frame is always visible regardless of window size.
        <DailyVideo
          automirror
          fit="contain"
          sessionId={sessionId}
          type={type}
          className="h-full w-full object-contain"
        />
      )}
      {canUnpin && (
        <button
          type="button"
          onClick={onUnpin}
          aria-label="Unpin"
          className="absolute top-4 right-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
        >
          <PinOff size={16} />
        </button>
      )}
    </div>
  );
}

/** Small draggable corner tile — a camera feed only (screen shares never sit here). */
function PipTile({
  sessionId,
  containerRef,
  onPin,
}: {
  sessionId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPin: () => void;
}) {
  const track = useVideoTrack(sessionId);
  const tileRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Offset>(ZERO_OFFSET);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const tile = tileRef.current;
      if (!container || !tile) return;
      const containerRect = container.getBoundingClientRect();
      const tileRect = tile.getBoundingClientRect();
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
        // Bounds computed once at drag start: how far the tile can move in
        // each direction, in terms of the OFFSET value, before its edge
        // would cross the container's edge. tileRect already reflects the
        // currently-applied offset, so subtracting/adding it back out gives
        // the offset value that lands the tile exactly on the boundary.
        minX: containerRect.left - tileRect.left + offset.x,
        maxX: containerRect.right - tileRect.right + offset.x,
        minY: containerRect.top - tileRect.top + offset.y,
        maxY: containerRect.bottom - tileRect.bottom + offset.y,
      };
      tile.setPointerCapture(event.pointerId);
    },
    [containerRef, offset.x, offset.y]
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setOffset({
      x: Math.min(drag.maxX, Math.max(drag.minX, drag.originX + dx)),
      y: Math.min(drag.maxY, Math.max(drag.minY, drag.originY + dy)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      ref={tileRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className="absolute bottom-24 right-6 h-28 w-20 cursor-grab touch-none overflow-hidden rounded-xl border border-white/15 bg-black shadow-lg active:cursor-grabbing sm:bottom-28 sm:h-40 sm:w-28"
    >
      {track.isOff ? (
        <AvatarFallback />
      ) : (
        // fit="contain" (was "cover") — same reasoning as MainTile above:
        // never crop, letterbox against this tile's own bg-black instead.
        <DailyVideo
          automirror
          fit="contain"
          sessionId={sessionId}
          className="h-full w-full object-contain"
        />
      )}
      <button
        type="button"
        onClick={(event) => {
          // Pinning is a click on the icon, not a drag — stop it from also
          // registering as the start of a pointer drag on the tile beneath.
          event.stopPropagation();
          onPin();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Pin"
        className="absolute top-1.5 right-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
      >
        <Pin size={13} />
      </button>
    </div>
  );
}

export default function CallVideoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const localSessionId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: "remote" });
  const remoteId = remoteIds[0];
  const { screens } = useScreenShare();
  const activeScreen = screens[0];
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  if (activeScreen) {
    // Screen share always takes the spotlight, same as Meet — pin state is
    // ignored while one's active (there's nothing useful to pin against a
    // screen share) and camera tiles drop to a small strip instead of a
    // single PIP.
    const cameraIds = [localSessionId, remoteId].filter((id): id is string => Boolean(id));
    return (
      <div ref={containerRef} className="absolute inset-0 bg-black">
        <DailyVideo
          fit="contain"
          sessionId={activeScreen.session_id}
          type="screenVideo"
          className="h-full w-full object-contain"
        />
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {cameraIds.map((id) => (
            <div
              key={id}
              className="h-16 w-24 overflow-hidden rounded-lg border border-white/15 bg-black shadow-lg sm:h-20 sm:w-32"
            >
              {/* fit="contain" (was "cover") — same "never crop" rule
                  applied consistently everywhere DailyVideo renders a
                  camera feed in this file, per Andreas: "that goes both on
                  the phone and it goes also on the desktop." */}
              <DailyVideo
                automirror
                fit="contain"
                sessionId={id}
                className="h-full w-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!localSessionId) {
    return <div ref={containerRef} className="absolute inset-0 bg-black" />;
  }

  // Auto layout: the remote participant is main if present (the normal,
  // two-person case); otherwise the local participant is — see this file's
  // top comment for why that matters when testing solo. A manual pin
  // overrides this as long as the pinned id still refers to someone
  // actually in the call.
  const autoMainId = remoteId ?? localSessionId;
  const mainId =
    pinnedId && (pinnedId === localSessionId || pinnedId === remoteId) ? pinnedId : autoMainId;
  const pipId = mainId === localSessionId ? (remoteId ?? null) : localSessionId;

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black">
      <MainTile
        sessionId={mainId}
        type="video"
        canUnpin={pinnedId !== null}
        onUnpin={() => setPinnedId(null)}
      />
      {pipId && (
        <PipTile
          sessionId={pipId}
          containerRef={containerRef}
          onPin={() => setPinnedId(pipId)}
        />
      )}
    </div>
  );
}
