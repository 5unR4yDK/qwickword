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
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useAudioTrack, useDaily, useLocalSessionId, useVideoTrack } from "@daily-co/daily-react";

export default function CallControls({ onLeave }: { onLeave: () => void }) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const videoTrack = useVideoTrack(localSessionId ?? "");
  const audioTrack = useAudioTrack(localSessionId ?? "");

  const toggleMic = useCallback(() => {
    daily?.setLocalAudio(audioTrack.isOff);
  }, [daily, audioTrack.isOff]);

  const toggleCamera = useCallback(() => {
    daily?.setLocalVideo(videoTrack.isOff);
  }, [daily, videoTrack.isOff]);

  const handleLeave = useCallback(() => {
    daily?.leave().catch((err) => {
      console.error("[Qwickword v2] Failed to leave the call cleanly:", err);
    });
    onLeave();
  }, [daily, onLeave]);

  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-3 backdrop-blur">
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
        onClick={handleLeave}
        aria-label="Leave call"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
      >
        <PhoneOff size={18} />
      </button>
    </div>
  );
}
