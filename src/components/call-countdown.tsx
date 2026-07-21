"use client";

import { useEffect, useRef } from "react";

/**
 * Formats a whole number of milliseconds as "M:SS", floored to whole seconds.
 * Not exported — only used inside this file.
 */
function formatRemaining(ms: number): string {
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
 * countdown approaches zero — see the ramp in the effect below.
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

/**
 * Display (plus, since 2026-07-21, a quiet audio cue) of a remaining-time
 * countdown, given `remainingMs` from the caller. As of Phase 0 item 6
 * ("Hard-end experience"), the ticking clock and the decision of what else to
 * show (the call area vs. the ended screen) live one level up in CallRoom
 * (src/components/call-room.tsx) — that's the single source of truth for
 * "is this call over", so this component still owns no clock of its own,
 * just reacts to the `remainingMs` it's given each render.
 *
 * This display is informational only. The actual hard end is enforced
 * server-side by Daily's `eject_at_room_exp` / `eject_after_elapsed` room
 * properties (set in src/lib/daily-rooms.ts).
 *
 * T-10s cue (built 2026-07-21, per Andreas's own spec from ROADMAP.md's
 * "Countdown polish" item — "a friendly, non-onerous audio cue in the last
 * seconds, not just visual... a very soft/low-volume tick starting around
 * T-10s, becoming a little more audible from T-5s down to zero... gentle and
 * friendly, not an alarm" — plus his follow-up "also shift to gentle reddish
 * by t-minus 10"):
 *  - Visual: a third colour stage between the existing amber "ending" state
 *    (T-30s to T-11s, unchanged) and the harsher solid red used once the
 *    call has actually ended. T-10s down to T-1s uses Tailwind's softer
 *    `rose` instead of `red` — deliberately gentler than the "Time's up"
 *    colour, so the last-ten-seconds warning doesn't look identical to (or
 *    louder than) the call actually being over.
 *  - Audio: a plain Web Audio API oscillator tick (no audio file asset to
 *    ship or license) once per whole second from T-10s to T-1s, quietly
 *    louder each second as it approaches zero. Needs a `"use client"`
 *    component with its own effect, so this file gained one — the rest of
 *    the component's behaviour (a stateless render of whatever `remainingMs`
 *    it's given) is unchanged.
 *  - Browsers require a user gesture before audio can play; by the time this
 *    countdown is running, the visitor has already interacted with the page
 *    (joined the pre-join lobby, pressed "Start now," etc.), so the
 *    AudioContext should already be unlockable — wrapped in try/catch
 *    regardless, since a blocked AudioContext should never break the visual
 *    countdown or crash the page.
 */
export default function CallCountdown({ remainingMs }: { remainingMs: number }) {
  const isOver = remainingMs <= 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isFinalCountdown = !isOver && remainingSeconds <= 10;
  const isEnding = !isOver && !isFinalCountdown && remainingMs < 30_000;

  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOver || remainingSeconds > 10 || remainingSeconds < 1) return;
    if (lastTickSecondRef.current === remainingSeconds) return;
    lastTickSecondRef.current = remainingSeconds;

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
      // 0 at T-10s, 1 at T-1s — "a very soft... tick starting around T-10s,
      // becoming a little more audible from T-5s down to zero."
      const progress = (10 - remainingSeconds) / 9;
      const volume = 0.04 + progress * 0.1;
      playTick(audioContext, volume);
    } catch (err) {
      console.error("[Qwickword] Countdown tick sound failed to play:", err);
    }
  }, [remainingSeconds, isOver]);

  useEffect(() => {
    return () => {
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <p
      role="timer"
      aria-live="polite"
      className={`text-4xl font-semibold tabular-nums ${
        isOver
          ? "text-red-600 dark:text-red-400"
          : isFinalCountdown
            ? "text-rose-500 dark:text-rose-300"
            : isEnding
              ? "text-amber-600 dark:text-amber-400"
              : "text-black dark:text-zinc-50"
      }`}
    >
      {isOver ? "Time's up" : formatRemaining(remainingMs)}
    </p>
  );
}
