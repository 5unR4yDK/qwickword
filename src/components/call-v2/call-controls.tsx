"use client";

// v2 call UI preview — CALL_UI_REBUILD_SPEC.md, section 2 ("Floating bottom
// control bar") and section 3b. A small centered pill of icon buttons over
// the video, matching Meet's placement/weight — replacing Daily Prebuilt's
// full-width control tray, which the production /[room] flow still uses.
//
// Scope note (see CALL_UI_REBUILD_SPEC.md section 6 and STATUS.md): this
// preview intentionally does NOT yet include the "End for everyone" vote
// button from the production flow (src/components/call-room.tsx) — mic,
// camera, and leave only, enough to judge the Meet-style look before
// porting the rest of the call's behaviour over.

import { useCallback } from "react";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Video, VideoOff } from "lucide-react";
import {
  useAudioTrack,
  useDaily,
  useLocalSessionId,
  useScreenShare,
  useVideoTrack,
} from "@daily-co/daily-react";

export default function CallControls({ onLeave }: { onLeave: () => void }) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const videoTrack = useVideoTrack(localSessionId ?? "");
  const audioTrack = useAudioTrack(localSessionId ?? "");
  // "we also need to be able to share screen like in Google Meet"
  // (2026-07-22, Andreas, interactive). isSharingScreen only reflects the
  // LOCAL participant's own share — this button toggles that; whichever
  // participant (either side) is sharing gets the spotlight in
  // call-video-grid.tsx regardless of who started it.
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
      console.error("[Qwickword v2] Failed to leave the call cleanly:", err);
    });
    onLeave();
  }, [daily, onLeave]);

  return (
    <div
      className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-3 backdrop-blur"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
    >
      {/* Explicit safe-area padding (2026-07-22, Andreas, interactive,
          mobile) so the control pill clears the home-indicator bar on
          notched phones, same reasoning as call-overlay.tsx's top padding. */}
      <button
        type="button"
        onClick={toggleMic}
        aria-pressed={!audioTrack.isOff}
        aria-label={audioTrack.isOff ? "Unmute" : "Mute"}
        className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${
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
        className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${
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
        className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${
          isSharingScreen ? "bg-blue-600 hover:bg-blue-700" : "bg-white/15 hover:bg-white/25"
        }`}
      >
        {isSharingScreen ? <MonitorX size={18} /> : <MonitorUp size={18} />}
      </button>
      <button
        type="button"
        onClick={handleLeave}
        aria-label="Leave call"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
      >
        <PhoneOff size={18} />
      </button>
    </div>
  );
}
