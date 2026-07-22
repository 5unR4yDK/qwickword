"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DURATION_PRESETS_SECONDS,
  formatDuration,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@/lib/duration";

type CreateRoomResponse = {
  url: string;
  name: string;
  exp: number;
  durationSeconds: number;
  mockMode: boolean;
};

type CreateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      link: string;
      roomPath: string;
      mockMode: boolean;
      durationSeconds: number;
    };

/**
 * The core create-link flow. Two ways to set a duration, side by side
 * (2026-07-22, Andreas, interactive: "Reinstate the buttons, so you can
 * still click a duration and get taken straight to the confirmation with
 * link added to clipboard... 1, 2, 5, 10, 15, 20 minutes... keep the manual
 * entry as well and the max of 30 minutes"):
 *  1. Preset buttons (DURATION_PRESETS_SECONDS, src/lib/duration.ts) —
 *     clicking one creates the room immediately, no separate "Create" step.
 *     This is the original one-click behaviour from 2026-07-21 ("the URL
 *     should automatically be copied... after you click that button"),
 *     reinstated here.
 *  2. A manual minutes field (added later that same night, when the preset
 *     buttons/dropdown were briefly swapped out for it entirely — this
 *     merges the two rather than picking one) for any whole-minute value the
 *     presets don't cover, submitted via its own "Create" button or Enter.
 *     Clamped to the shared MIN_/MAX_DURATION_MINUTES bounds so it can never
 *     submit a value the API route's own bounds check would reject.
 * Both paths funnel into the same `handleCreate`, so the success screen
 * below (auto-copy, "Join the meeting now," etc.) behaves identically either
 * way.
 */
export default function CreateLinkForm() {
  const [minutesInput, setMinutesInput] = useState<string>("");
  const [state, setState] = useState<CreateState>({ status: "idle" });
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [copied, setCopied] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Whole minutes only, within the shared bounds. An empty, non-integer, or
  // out-of-range value is invalid — the Create button stays disabled and a
  // short hint explains the range, rather than firing a request the server
  // would just reject.
  const parsedMinutes = Number(minutesInput);
  const isValidDuration =
    minutesInput.trim() !== "" &&
    Number.isInteger(parsedMinutes) &&
    parsedMinutes >= MIN_DURATION_MINUTES &&
    parsedMinutes <= MAX_DURATION_MINUTES;

  async function handleCreate(durationSeconds: number) {
    setState({ status: "loading" });
    setCopied(false);

    let response: Response;
    try {
      response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
    } catch {
      setState({
        status: "error",
        message: "Couldn't reach the server. Check your connection and try again.",
      });
      return;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      setState({
        status: "error",
        message: "The server sent back something unexpected. Try again.",
      });
      return;
    }

    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error: unknown }).error)
          : `Request failed (${response.status}).`;
      setState({ status: "error", message });
      return;
    }

    const room = data as CreateRoomResponse;
    // `exp` and `d` (durationSeconds) both ride along in the query string so
    // the call page (`/[room]`) needs no server-side lookup for a first
    // render — see src/app/[room]/page.tsx. Note `exp` here is the room's
    // *pre-start* buffer, not the real call length: the countdown doesn't
    // actually start until someone presses "Start now" or a second person
    // joins (src/lib/daily-rooms.ts, "Anchor the countdown to first join").
    // `d` is what the call page uses to start the real countdown at that
    // point, and what the waiting screen displays before then.
    const roomPath = `/${room.name}?exp=${room.exp}&d=${room.durationSeconds}`;
    const link = `${window.location.origin}${roomPath}`;

    setState({
      status: "success",
      link,
      roomPath,
      mockMode: room.mockMode,
      durationSeconds: room.durationSeconds,
    });

    // Best-effort auto-copy. This can fail silently (insecure context,
    // permission denied, or — notably in Safari — because the `await fetch`
    // above already spent the click's "user activation" window). Either way
    // the link is still visible below and the manual "Copy link" button
    // still works, so a failed auto-copy is not fatal, just quietly skipped.
    try {
      await navigator.clipboard.writeText(link);
      setShowCopiedToast(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setShowCopiedToast(false), 2500);
    } catch {
      // no-op, see comment above
    }
  }

  function handleSubmit() {
    if (!isValidDuration || state.status === "loading") return;
    handleCreate(parsedMinutes * 60);
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (state.status === "success") {
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        {showCopiedToast && (
          // In-flow, not `fixed` (was fixed to the viewport top, which
          // overlapped the page's own "Qwickword" heading above this card —
          // Andreas flagged this 2026-07-21). Sitting in the normal layout
          // right above the "ready" line keeps it near the action without
          // ever covering unrelated content, regardless of viewport size.
          <div
            role="status"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-emerald-500"
          >
            Link copied to clipboard!
          </div>
        )}
        <p className="text-lg font-medium text-black dark:text-zinc-50">
          Your {formatDuration(state.durationSeconds)} Qwickword is ready.
        </p>
        {state.mockMode && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Mock mode — this link is simulated, not a real call yet.
          </p>
        )}
        <div className="flex w-full items-center gap-2">
          <input
            readOnly
            value={state.link}
            aria-label="Shareable Qwickword link"
            onFocus={(event) => event.currentTarget.select()}
            className="w-full min-w-0 rounded-full border border-black/[.08] bg-zinc-50 px-4 py-2 text-sm text-zinc-800 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-200"
          />
          <button
            type="button"
            onClick={() => handleCopy(state.link)}
            className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <Link
          href={state.roomPath}
          className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Join the meeting now
        </Link>
        <button
          type="button"
          onClick={() => {
            setState({ status: "idle" });
            setCopied(false);
            setShowCopiedToast(false);
          }}
          className="text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Create another
        </button>
      </div>
    );
  }

  const isLoading = state.status === "loading";

  return (
    <form
      className="flex w-full flex-col items-center gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        How long is your quick word?
      </p>
      <div
        role="group"
        aria-label="Quick durations"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {DURATION_PRESETS_SECONDS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            disabled={isLoading}
            onClick={() => handleCreate(seconds)}
            className="flex h-11 min-w-14 items-center justify-center rounded-full border border-black/[.08] bg-zinc-50 px-4 text-sm font-medium text-zinc-900 transition-colors hover:border-black/[.3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-white/[.4]"
          >
            {formatDuration(seconds)}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        or pick a custom length
      </p>
      <label
        htmlFor="duration-minutes"
        className="sr-only"
      >
        Custom call length in minutes
      </label>
      <div className="flex items-center gap-2">
        <input
          id="duration-minutes"
          type="number"
          inputMode="numeric"
          min={MIN_DURATION_MINUTES}
          max={MAX_DURATION_MINUTES}
          step={1}
          value={minutesInput}
          onChange={(event) => setMinutesInput(event.target.value)}
          disabled={isLoading}
          aria-label="Call length in minutes"
          aria-describedby="duration-hint"
          aria-invalid={!isValidDuration}
          className="w-24 rounded-full border border-black/[.08] bg-zinc-50 px-4 py-2 text-center text-lg font-medium tabular-nums text-zinc-900 outline-none focus:border-black/[.3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/[.4] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-base text-zinc-600 dark:text-zinc-400">min</span>
      </div>
      <p id="duration-hint" className="text-xs text-zinc-400 dark:text-zinc-500">
        {MIN_DURATION_MINUTES}–{MAX_DURATION_MINUTES} minutes, whole minutes
        only.
      </p>
      <button
        type="submit"
        disabled={isLoading || !isValidDuration}
        className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isLoading ? "Creating…" : "Create Qwickword"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
