"use client";

// Home-page settings menu — a gear icon opening a small panel to pre-set
// camera/microphone and the countdown tick sound *before* creating or
// opening a call, so nobody has to fiddle with device pickers while the
// clock is already running. *(Roadmap: "add to roadmap... ability to set
// sound and video there so you dont do it while the clock is ticking,"
// 2026-07-21, Andreas, interactive. "Sound" here means the T-10s countdown
// tick's on/off state — see call-overlay.tsx — since that's the only audio
// cue this app has; the camera/mic choice is the "video" half.)*
//
// Choices are stored via src/lib/call-preferences.ts (localStorage, no
// accounts) and picked up automatically by call-prejoin.tsx (device
// selection) and call-overlay.tsx (sound on/off) the next time a call is
// opened. This menu itself never touches an active call — it's purely
// "set it here, ahead of time."
//
// Positioned top-right, mirroring theme-toggle.tsx's top-left placement
// (same size/style, so the two read as a matched pair of corner icons).

import { useEffect, useRef, useState } from "react";
import { Settings, Volume2, VolumeX } from "lucide-react";
import {
  getCountdownSoundEnabled,
  getPreferredCameraId,
  getPreferredMicId,
  setCountdownSoundEnabled,
  setPreferredCameraId,
  setPreferredMicId,
} from "@/lib/call-preferences";

type DeviceOption = { deviceId: string; label: string };

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [labelsHidden, setLabelsHidden] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Loads stored preferences and the current device list once the panel
  // first opens — not on every render, and not before the user asks for it,
  // since enumerateDevices() is a real (if usually instant) browser call.
  async function refreshDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setCameras(cams);
      setMicrophones(mics);
      // Labels are blank until a getUserMedia permission has been granted on
      // this origin before (a browser privacy rule, not a bug) — surfaced so
      // the "Show device names" action below makes sense rather than looking
      // broken. Detected by checking whether every label is still the
      // generic fallback this component itself assigned above.
      const allDevices = [...cams, ...mics];
      setLabelsHidden(
        allDevices.length > 0 &&
          allDevices.every((d) => /^(Camera|Microphone) \d+$/.test(d.label))
      );
    } catch (err) {
      console.error("[Qwickword] Couldn't list camera/microphone devices:", err);
    }
  }

  // Deferred via a zero-delay setTimeout, same pattern used elsewhere in this
  // app (theme-toggle.tsx, call-room.tsx's countdown tick) to stay clear of
  // react-hooks/set-state-in-effect — that rule targets setState calls made
  // unconditionally and synchronously as the effect body runs, not ones
  // deferred into a callback like this.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setCameraId(getPreferredCameraId() ?? "");
      setMicId(getPreferredMicId() ?? "");
      setSoundEnabled(getCountdownSoundEnabled());
      void refreshDevices();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  // Click-outside and Escape both close the panel — standard popover
  // behavior, matches how a settings menu is expected to work.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Briefly requests camera/mic permission just to reveal real device
  // labels, then immediately stops every track — this never keeps a camera
  // or mic "live," it only unlocks the names the browser was already
  // withholding. Entirely optional; skipping it still lets someone pick a
  // device, just by a generic "Camera 1"-style name.
  async function detectDeviceNames() {
    setDetecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      await refreshDevices();
    } catch (err) {
      console.error("[Qwickword] Couldn't get permission to show device names:", err);
    } finally {
      setDetecting(false);
    }
  }

  function chooseCamera(deviceId: string) {
    setCameraId(deviceId);
    setPreferredCameraId(deviceId || null);
  }

  function chooseMic(deviceId: string) {
    setMicId(deviceId);
    setPreferredMicId(deviceId || null);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setCountdownSoundEnabled(next);
  }

  return (
    <div className="absolute top-4 right-4 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Call settings"
        aria-expanded={open}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/[.08] bg-white/70 text-zinc-700 backdrop-blur-sm transition-colors hover:bg-white dark:border-white/[.145] dark:bg-white/[.06] dark:text-zinc-300 dark:hover:bg-white/[.12]"
      >
        <Settings size={16} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute top-11 right-0 flex w-72 flex-col gap-4 rounded-2xl border border-black/[.08] bg-white/95 p-4 text-left shadow-lg backdrop-blur-sm dark:border-white/[.145] dark:bg-zinc-900/95"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-black dark:text-zinc-50">Call settings</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Applied automatically the next time you join a Qwickword — no need to fiddle with
              these once the clock is running.
            </p>
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Camera
            <select
              value={cameraId}
              onChange={(e) => chooseCamera(e.target.value)}
              className="rounded-full border border-black/[.08] bg-white px-3 py-2 text-sm text-zinc-800 dark:border-white/[.145] dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">System default</option>
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Microphone
            <select
              value={micId}
              onChange={(e) => chooseMic(e.target.value)}
              className="rounded-full border border-black/[.08] bg-white px-3 py-2 text-sm text-zinc-800 dark:border-white/[.145] dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">System default</option>
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
          </label>

          {labelsHidden && (
            <button
              type="button"
              onClick={() => void detectDeviceNames()}
              disabled={detecting}
              className="cursor-pointer text-left text-xs font-medium text-indigo-600 underline decoration-dotted underline-offset-2 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-400"
            >
              {detecting ? "Requesting permission…" : "Show real device names"}
            </button>
          )}

          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-full border border-black/[.08] bg-white px-3 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-white/[.145] dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <span className="flex items-center gap-2">
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              Countdown tick sound
            </span>
            <span
              className={`text-xs font-semibold ${
                soundEnabled ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"
              }`}
            >
              {soundEnabled ? "On" : "Off"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
