"use client";

// v2 call UI preview — CALL_UI_REBUILD_SPEC.md, section 3a. A custom prejoin
// screen (camera preview, device pickers, mic/camera toggle, Join button),
// replacing Daily Prebuilt's own hosted lobby (which the production /[room]
// flow still uses — this file is /test-only, see src/app/test/[room]/page.tsx).
//
// Built per Daily's own "Add a prejoin UI" pattern: startCamera({ url })
// starts local media and previews it WITHOUT joining the room yet; join()
// (on the button below) is the actual join, using whatever devices/state
// startCamera already set up.

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import {
  useAudioTrack,
  useDaily,
  useDevices,
  useLocalSessionId,
  useVideoTrack,
} from "@daily-co/daily-react";

export default function CallPrejoin({
  joinUrl,
  onJoined,
}: {
  joinUrl: string;
  onJoined: () => void;
}) {
  const daily = useDaily();
  const [starting, setStarting] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { cameras, microphones, setCamera, setMicrophone } = useDevices();
  const localSessionId = useLocalSessionId();
  const videoTrack = useVideoTrack(localSessionId ?? "");
  const audioTrack = useAudioTrack(localSessionId ?? "");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!daily) return;
    let cancelled = false;
    (async () => {
      try {
        await daily.startCamera({ url: joinUrl });
      } catch (err) {
        console.error("[Qwickword v2] Failed to start the camera preview:", err);
        if (!cancelled) {
          setError(
            "Couldn't access your camera or microphone. Check your browser permissions and try again."
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [daily, joinUrl]);

  // DailyVideo (daily-react's component) needs a real DailyProvider-managed
  // participant to render, which the local participant technically isn't
  // until join() — so the preview here renders a plain <video> tag wired
  // directly to the track's persistentTrack instead, same approach Daily's
  // own prejoin guide uses.
  useEffect(() => {
    if (!videoRef.current) return;
    const track = videoTrack.persistentTrack;
    videoRef.current.srcObject = track ? new MediaStream([track]) : null;
  }, [videoTrack.persistentTrack]);

  const toggleMic = useCallback(() => {
    daily?.setLocalAudio(audioTrack.isOff);
  }, [daily, audioTrack.isOff]);

  const toggleCamera = useCallback(() => {
    daily?.setLocalVideo(videoTrack.isOff);
  }, [daily, videoTrack.isOff]);

  const handleJoin = useCallback(async () => {
    if (!daily || joining) return;
    setJoining(true);
    setError(null);
    try {
      await daily.join();
      onJoined();
    } catch (err) {
      console.error("[Qwickword v2] Failed to join the call:", err);
      setError("Couldn't join the call. Try again.");
      setJoining(false);
    }
  }, [daily, joining, onJoined]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black px-4 py-8">
      {/* Single width-controlling wrapper around the video, the device
          pickers, and the Join button (2026-07-22, Andreas, interactive:
          "the settings for the video call were not properly centered under
          the video... they should be centered and ideally the same width").
          Every child below is `w-full` and relies on THIS element for its
          max-width/centering, rather than each declaring its own max-w-xl
          separately — that duplication was the actual bug: any small
          difference between the video's and the selects' own width/margin
          classes would show up as visible misalignment. One source of truth
          for the width fixes that by construction. */}
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-900">
          {videoTrack.isOff || !videoTrack.persistentTrack ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
              {starting ? "Starting camera…" : "Camera is off"}
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full -scale-x-100 object-cover"
            />
          )}

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-2 backdrop-blur">
            <button
              type="button"
              onClick={toggleMic}
              disabled={starting}
              aria-pressed={!audioTrack.isOff}
              aria-label={audioTrack.isOff ? "Unmute" : "Mute"}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                audioTrack.isOff ? "bg-red-600 hover:bg-red-700" : "bg-white/15 hover:bg-white/25"
              }`}
            >
              {audioTrack.isOff ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              disabled={starting}
              aria-pressed={!videoTrack.isOff}
              aria-label={videoTrack.isOff ? "Turn camera on" : "Turn camera off"}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                videoTrack.isOff ? "bg-red-600 hover:bg-red-700" : "bg-white/15 hover:bg-white/25"
              }`}
            >
              {videoTrack.isOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
          </div>
        </div>

        {(cameras.length > 0 || microphones.length > 0) && (
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            {cameras.length > 0 && (
              <select
                aria-label="Camera"
                onChange={(event) => setCamera(event.target.value)}
                className="flex-1 rounded-full border border-white/15 bg-zinc-900 px-4 py-2 text-sm text-zinc-100"
              >
                {cameras.map((cam) => (
                  <option key={cam.device.deviceId} value={cam.device.deviceId}>
                    {cam.device.label || "Camera"}
                  </option>
                ))}
              </select>
            )}
            {microphones.length > 0 && (
              <select
                aria-label="Microphone"
                onChange={(event) => setMicrophone(event.target.value)}
                className="flex-1 rounded-full border border-white/15 bg-zinc-900 px-4 py-2 text-sm text-zinc-100"
              >
                {microphones.map((mic) => (
                  <option key={mic.device.deviceId} value={mic.device.deviceId}>
                    {mic.device.label || "Microphone"}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleJoin()}
          disabled={starting || joining}
          className="flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-base font-medium text-black transition-colors hover:enabled:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {joining ? "Joining…" : "Join"}
        </button>
      </div>
    </div>
  );
}
