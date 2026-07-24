"use client";

// Minimal top overlay for meeting identity/branding — CALL_UI_REBUILD_SPEC.md,
// section 2 and 3b. "Qwickword" + the live countdown as a translucent overlay
// ON the video. Promoted to production 2026-07-22 alongside the rest of the
// call-object-mode UI — see src/components/call-room.tsx. This absorbs both
// the countdown math AND the T-10s audio tick that used to live in the old
// src/components/call-countdown.tsx (deleted the same day — nothing else
// used it once the old Daily-Prebuilt call flow it belonged to was retired).

import { useEffect, useRef } from "react";
import { getCountdownSoundEnabled } from "@/lib/call-preferences";

/** Formats a whole number of milliseconds as "M:SS", floored to whole seconds. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Plays one short, soft tick using the Web Audio API — no audio file asset,
 * just a brief sine tone with a fast attack/decay envelope so it reads as a
 * gentle tick rather than a beep or alarm. `volume` (0–1) is the only thing
 * that varies call to call, so the same tick can get quietly louder as the
 * countdown approaches zero.
 */
function playTick(audioContext: AudioContext, volume: number): void {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  const now = audioContext.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.13);
}

export default function CallOverlay({
  remainingMs,
  started,
}: {
  remainingMs: number;
  /**
   * Whether the real countdown has started ("waiting to start" vs. ticking
   * state). Before `started`, `remainingMs` reflects the ~24h pre-start
   * buffer (see PRE_START_BUFFER_SECONDS in src/lib/daily-rooms.ts), not a
   * real countdown — this shows "Waiting to start" instead of that number
   * until `started` is true.
   */
  started: boolean;
}) {
  const isOver = remainingMs <= 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isFinalCountdown = started && !isOver && remainingSeconds <= 10;

  // T-10s audio tick (ported from the old call-countdown.tsx, per Andreas's
  // original spec: "a very soft/low-volume tick starting around T-10s,
  // becoming a little more audible from T-5s down to zero... gentle and
  // friendly, not an alarm"). Only runs once `started` — the pre-start
  // buffer's own huge `remainingSeconds` would otherwise sit way outside the
  // 1–10 window this checks anyway, but gating on `started` explicitly
  // keeps that self-evident rather than incidental.
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (!started || isOver || remainingSeconds > 10 || remainingSeconds < 1) return;
    if (lastTickSecondRef.current === remainingSeconds) return;
    lastTickSecondRef.current = remainingSeconds;
    // Settings-menu preference (src/components/settings-menu.tsx / src/lib/
    // call-preferences.ts) — "Countdown tick sound" toggle. Defaults to on,
    // so this is a no-op for anyone who hasn't touched the setting.
    if (!getCountdownSoundEnabled()) return;

    try {
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        audioContextRef.current = new AudioContextClass();
      }
      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") void audioContext.resume();
      const progress = (10 - remainingSeconds) / 9;
      const volume = 0.04 + progress * 0.1;
      playTick(audioContext, volume);
    } catch (err) {
      console.error("[Qwickword] Countdown tick sound failed to play:", err);
    }
  }, [started, remainingSeconds, isOver]);

  useEffect(() => {
    return () => {
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-0.5 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 text-center"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
    >
      {/* Explicit safe-area padding so the timer stays clear of the notch
          on phones where the browser chrome overlaps the top of the
          viewport, on top of the h-dvh/fixed layout that keeps this overlay
          from ever being scrolled out of view. */}
      <p className="text-xs font-medium tracking-wide text-white/70">Qwickword</p>
      {started ? (
        <>
          <p
            role="timer"
            aria-live="polite"
            // Bigger on desktop (2026-07-22, Andreas, interactive: "on
            // desktop it's OK for the counter... to be slightly bigger...
            // it's a little bit nondistinct now, hard to see... it should
            // be more central given how important it is"). Kept the mobile
            // size (text-2xl) as-is — phone screens are tighter and the
            // existing size already reads fine there — and only grows it
            // from the `sm` breakpoint up, where there's room to spare.
            className={`text-2xl font-semibold tabular-nums sm:text-4xl ${
              isFinalCountdown ? "text-rose-300" : "text-white"
            }`}
          >
            {isOver ? "Time's up" : formatRemaining(remainingMs)}
          </p>
          {isFinalCountdown && (
            <p className="text-xs font-medium text-rose-300 sm:text-sm">Time to wrap!</p>
          )}
        </>
      ) : (
        <p className="text-sm font-medium text-white/80">Waiting to start</p>
      )}
    </div>
  );
}
