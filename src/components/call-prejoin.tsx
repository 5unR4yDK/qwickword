"use client";

// Custom prejoin screen: a self-view mirror with mic/camera toggles, device
// pickers, and one Join button, next to an invitation that states the deal —
// how long the call is and that it ends by itself. Replaces Daily Prebuilt's
// own hosted lobby, alongside the rest of the call-object-mode UI — see
// src/components/call-room.tsx.
//
// Built per Daily's own "Add a prejoin UI" pattern: startCamera({ url })
// starts local media and previews it WITHOUT joining the room yet; join()
// (on the button below) is the actual join, using whatever devices/state
// startCamera already set up.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";
import {
  useAudioTrack,
  useDaily,
  useDevices,
  useLocalSessionId,
  useVideoTrack,
} from "@daily-co/daily-react";
import { getPreferredCameraId, getPreferredMicId } from "@/lib/call-preferences";

export default function CallPrejoin({
  joinUrl,
  durationSeconds,
  onJoined,
}: {
  joinUrl: string;
  /** The call's intended length; omitted for legacy links that don't carry it. */
  durationSeconds?: number;
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
        console.error("[Qwickword] Failed to start the camera preview:", err);
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

  // Applies whatever camera/mic was chosen ahead of time in the home page's
  // settings menu (src/components/settings-menu.tsx / src/lib/
  // call-preferences.ts) — the whole point being that this happens
  // automatically here, once, rather than requiring a manual pick while the
  // countdown is already running. Runs once per device list becoming
  // non-empty; if the stored deviceId isn't actually present (unplugged,
  // different browser/profile than the one the preference was set in), it's
  // silently skipped and startCamera's own system-default choice stands.
  const appliedCameraPrefRef = useRef(false);
  useEffect(() => {
    if (appliedCameraPrefRef.current || cameras.length === 0) return;
    appliedCameraPrefRef.current = true;
    const preferredId = getPreferredCameraId();
    if (!preferredId) return;
    const match = cameras.find((cam) => cam.device.deviceId === preferredId);
    if (match && !match.selected) {
      setCamera(preferredId);
    }
  }, [cameras, setCamera]);

  const appliedMicPrefRef = useRef(false);
  useEffect(() => {
    if (appliedMicPrefRef.current || microphones.length === 0) return;
    appliedMicPrefRef.current = true;
    const preferredId = getPreferredMicId();
    if (!preferredId) return;
    const match = microphones.find((mic) => mic.device.deviceId === preferredId);
    if (match && !match.selected) {
      setMicrophone(preferredId);
    }
  }, [microphones, setMicrophone]);

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
      console.error("[Qwickword] Failed to join the call:", err);
      setError("Couldn't join the call. Try again.");
      setJoining(false);
    }
  }, [daily, joining, onJoined]);

  const minutes = durationSeconds ? Math.round(durationSeconds / 60) : null;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-black">
      {/* Ambient glow behind the invitation column — background layer only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-1/2 left-1/2 h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.10)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen lg:left-[72%]"
      />

      <div className="relative flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10 lg:flex-row lg:gap-11 lg:px-14">
        {/* The mirror. */}
        <div className="relative aspect-[49/33] w-full max-w-[490px] shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#0a0a0a] lg:h-[330px] lg:w-[490px]">
          {videoTrack.isOff || !videoTrack.persistentTrack ? (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs tracking-[0.2em] text-zinc-600 uppercase">
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

          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMic}
              disabled={starting}
              aria-pressed={!audioTrack.isOff}
              aria-label={audioTrack.isOff ? "Unmute" : "Mute"}
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white backdrop-blur-[8px] transition-colors duration-150 hover:bg-[rgba(61,254,241,0.9)] hover:text-[#062B28] disabled:cursor-not-allowed disabled:opacity-40 ${
                audioTrack.isOff ? "bg-red-600/80" : "bg-black/65"
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
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white backdrop-blur-[8px] transition-colors duration-150 hover:bg-[rgba(61,254,241,0.9)] hover:text-[#062B28] disabled:cursor-not-allowed disabled:opacity-40 ${
                videoTrack.isOff ? "bg-red-600/80" : "bg-black/65"
              }`}
            >
              {videoTrack.isOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
          </div>
        </div>

        {/* The invitation. */}
        <div className="flex w-full max-w-[440px] flex-col gap-[26px]">
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/wordmark-only.svg"
              alt="qwickword.com"
              className="h-auto w-[230px] opacity-80"
            />
            <h1 className="text-[26px] leading-[34px] font-medium text-[#FAFAFA]">
              {minutes ? (
                <>
                  You&apos;re joining a{" "}
                  <span className="text-[#3DFEF1]">{minutes} minute</span>{" "}
                  Qwickword.
                </>
              ) : (
                <>You&apos;re joining a Qwickword.</>
              )}
            </h1>
            <p className="text-[15px] leading-[23px] text-[#8A8A8F]">
              It ends by itself when the timer runs out — no extending, no
              rejoining. Nothing counts down until the second person is here.
            </p>
          </div>

          {(cameras.length > 0 || microphones.length > 0) && (
            <div className="flex flex-col gap-2">
              {cameras.length > 0 && (
                <DeviceRow
                  icon={<Video size={14} aria-hidden="true" />}
                  label="Camera"
                  value={cameras.find((cam) => cam.selected)?.device.deviceId ?? ""}
                  onChange={setCamera}
                  options={cameras.map((cam) => ({
                    id: cam.device.deviceId,
                    label: cam.device.label || "Camera",
                  }))}
                />
              )}
              {microphones.length > 0 && (
                <DeviceRow
                  icon={<Mic size={14} aria-hidden="true" />}
                  label="Microphone"
                  value={
                    microphones.find((mic) => mic.selected)?.device.deviceId ?? ""
                  }
                  onChange={setMicrophone}
                  options={microphones.map((mic) => ({
                    id: mic.device.deviceId,
                    label: mic.device.label || "Microphone",
                  }))}
                />
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
            className="flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-[#3DFEF1] text-base font-semibold text-[#062B28] transition-colors duration-150 hover:enabled:bg-[#7FFFF5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joining ? "Joining…" : "Join the Qwickword"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A 44px device-picker row: leading icon, the device name (truncated —
 * real device strings are long), trailing chevron. The interactive element
 * is a native <select> stretched invisibly across the whole row, so it
 * stays keyboard- and screen-reader-operable while the visible layer is
 * fully styled.
 */
function DeviceRow({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (deviceId: string) => void;
  options: { id: string; label: string }[];
}) {
  const selected = options.find((option) => option.id === value);
  return (
    <div className="relative flex h-11 items-center gap-2 rounded-[10px] border border-white/[0.145] bg-white/[0.03] px-3.5 transition-colors duration-150 hover:border-[rgba(61,254,241,0.5)]">
      <span className="shrink-0 text-[#71717A]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[#D4D4D8]">
        {selected?.label ?? label}
      </span>
      <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-[#71717A]" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
