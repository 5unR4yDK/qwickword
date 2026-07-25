"use client";

// Top overlay for meeting identity/branding: the cursive wordmark + the live
// countdown as a translucent overlay ON the video, alongside the rest of the
// call-object-mode UI — see src/components/call-room.tsx. This owns the
// countdown math, the T-10s audio tick, and the final-ten-seconds warning
// treatment (rose timer, frame glow, bottom progress rail).

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
  durationSeconds,
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
  /**
   * The call's full length in seconds, for the final-ten-seconds progress
   * rail. Optional — legacy links minted before durations rode along in the
   * URL don't carry it, and the rail simply doesn't render without it.
   */
  durationSeconds?: number;
}) {
  const isOver = remainingMs <= 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isFinalCountdown = started && !isOver && remainingSeconds <= 10;

  // Fraction of the call remaining, for the bottom progress rail. Only
  // meaningful once ticking and only when the duration is known.
  const remainingFraction =
    durationSeconds && durationSeconds > 0
      ? Math.min(1, Math.max(0, remainingMs / (durationSeconds * 1000)))
      : null;

  // T-10s audio tick: soft, low-volume, starting around T-10s and becoming
  // a little more audible down to zero — gentle and friendly, not an alarm.
  // Only runs once `started` — the pre-start buffer's own huge
  // `remainingSeconds` would otherwise sit way outside the 1–10 window this
  // checks anyway, but gating on `started` explicitly keeps that
  // self-evident rather than incidental.
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
    <>
      {/* Final-ten-seconds frame warning: an inset rose glow around the
          whole viewport. Colour transitions in rather than snapping; no
          flashing. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 motion-reduce:transition-none ${
          isFinalCountdown ? "opacity-100" : "opacity-0"
        }`}
        style={{
          boxShadow:
            "inset 0 0 0 2px rgba(253,164,175,0.55), inset 0 0 70px rgba(253,164,175,0.18)",
        }}
      />

      {/* Top scrim + wordmark + timer stack. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1.5 bg-gradient-to-b from-black/72 to-transparent px-4 text-center ${
          isFinalCountdown ? "pb-14" : "pb-10"
        }`}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {/* Explicit safe-area padding so the timer stays clear of the notch
            on phones where the browser chrome overlaps the top of the
            viewport, on top of the h-dvh/fixed layout that keeps this
            overlay from ever being scrolled out of view. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/wordmark-only.svg"
          alt="qwickword.com"
          className={`h-auto w-[132px] transition-opacity duration-500 ${
            isFinalCountdown ? "opacity-60" : "opacity-70"
          }`}
        />
        {started ? (
          <>
            <p
              role="timer"
              aria-live="polite"
              className={`font-semibold tabular-nums transition-colors duration-500 motion-reduce:transition-none ${
                isFinalCountdown
                  ? "text-[52px] leading-[1.05] text-[#FDA4AF]"
                  : "text-[40px] leading-[1.1] text-[#3DFEF1]"
              }`}
            >
              {isOver ? "Time's up" : formatRemaining(remainingMs)}
            </p>
            {isFinalCountdown && (
              <p className="text-sm font-semibold tracking-[0.1em] text-[#FDA4AF] uppercase">
                Time to wrap
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-white/80">Waiting to start</p>
        )}
      </div>

      {/* Bottom progress rail — final ten seconds only, remaining fraction
          of the whole call. */}
      {isFinalCountdown && remainingFraction !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-white/[0.06]"
        >
          <div
            className="h-full bg-[#FDA4AF] transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
            style={{ width: `${remainingFraction * 100}%` }}
          />
        </div>
      )}
    </>
  );
}
