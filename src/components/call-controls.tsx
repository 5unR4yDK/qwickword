"use client";

// Floating bottom control bar — CALL_UI_REBUILD_SPEC.md, section 2 and 3b. A
// small centered pill of icon buttons over the video, matching Meet's
// placement/weight. Promoted to production 2026-07-22 alongside the rest of
// the call-object-mode UI — see src/components/call-room.tsx.

import { useCallback } from "react";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Video, VideoOff } from "lucide-react";
import {
  useAudioTrack,
  useDaily,
  useLocalSessionId,
  useScreenShare,
  useVideoTrack,
} from "@daily-co/daily-react";

export default function CallControls({
  onLeave,
  started,
  starting,
  onStart,
}: {
  onLeave: () => void;
  /** Whether the real countdown has started — see call-room.tsx. */
  started: boolean;
  /** True while a triggerStart() request is in flight. */
  starting: boolean;
  /** Manual start trigger — the other path (a second participant joining) is
   * handled by call-room.tsx's own AutoStartWatcher, not this component. */
  onStart: () => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const videoTrack = useVideoTrack(localSessionId ?? "");
  const audioTrack = useAudioTrack(localSessionId ?? "");
  // isSharingScreen only reflects the LOCAL participant's own share — this
  // button toggles that; whichever participant (either side) is sharing gets
  // the spotlight in call-video-grid.tsx regardless of who started it.
  const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();

  const toggleMic = useCallback(() => {
    daily?.setLocalAudio(audioTrack.isOff);
  }, [daily, audioTrack.isOff]);

  const toggleCamera = useCallback(() => {
    daily?.setLocalVideo(videoTrack.isOff);
  }, [daily, videoTrack.isOff]);

  const toggleScreenShare = useCallback(() => {
    if (isSharingScreen) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isSharingScreen, startScreenShare, stopScreenShare]);

  const handleLeave = useCallback(() => {
    daily?.leave().catch((err) => {
      console.error("[Qwickword] Failed to leave the call cleanly:", err);
    });
    onLeave();
  }, [daily, onLeave]);

  return (
    <div
      className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-3 backdrop-blur"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
    >
      {/* Explicit safe-area padding so the control pill clears the
          home-indicator bar on notched phones. */}
      <button
        type="button"
        onClick={toggleMic}
        aria-pressed={!audioTrack.isOff}
        aria-label={audioTrack.isOff ? "Unmute" : "Mute"}
        className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors ${
          audioTrack.isOff ? "bg-red-600 hover:bg-red-700" : "bg-white/15 hover:bg-white/25"
        }`}
      >
        {audioTrack.isOff ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      <button
        type="button"
        onClick={toggleCamera}
        aria-pressed={!videoTrack.isOff}
        aria-label={videoTrack.isOff ? "Turn camera on" : "Turn camera off"}
        className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors ${
          videoTrack.isOff ? "bg-red-600 hover:bg-red-700" : "bg-white/15 hover:bg-white/25"
        }`}
      >
        {videoTrack.isOff ? <VideoOff size={18} /> : <Video size={18} />}
      </button>
      <button
        type="button"
        onClick={toggleScreenShare}
        aria-pressed={isSharingScreen}
        aria-label={isSharingScreen ? "Stop sharing your screen" : "Share your screen"}
        className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors ${
          isSharingScreen ? "bg-blue-600 hover:bg-blue-700" : "bg-white/15 hover:bg-white/25"
        }`}
      >
        {isSharingScreen ? <MonitorX size={18} /> : <MonitorUp size={18} />}
      </button>
      {/* "Start now," folded into this same pill (2026-07-22, Andreas,
          interactive: "the start now button... should feature down next to
          the toggle buttons for microphone and camera and sharing and
          ending call... an equally colored, equally formatted button down
          there... of equal height and same coloring format"). Used to be a
          separate floating white pill top-right, disconnected from the rest
          of the call's controls — now it's just another member of the same
          bar, same h-11 height as every icon button beside it. Kept the
          white fill (rather than the neutral bg-white/15 the toggle buttons
          use) since Start is a one-time primary action, not a toggle — same
          "white = the primary action" language this app already uses for
          Join/Copy/Create elsewhere. Only rendered before the countdown has
          actually started; once `started` is true there's nothing left to
          start. */}
      {!started && (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="flex h-11 cursor-pointer items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:enabled:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? "Starting…" : "Start now"}
        </button>
      )}
      <button
        type="button"
        onClick={handleLeave}
        aria-label="Leave call"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
      >
        <PhoneOff size={18} />
      </button>
    </div>
  );
}
