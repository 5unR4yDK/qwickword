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
 * The core create-link flow. Two ways to set a duration:
 *  1. Preset buttons (DURATION_PRESETS_SECONDS, src/lib/duration.ts) —
 *     clicking one creates the room immediately, no separate "Create" step
 *     (2026-07-21: "the URL should automatically be copied... after you
 *     click that button").
 *  2. A manual minutes field for any whole-minute value the presets don't
 *     cover, submitted via its own "Create" button or Enter. Clamped to the
 *     shared MIN_/MAX_DURATION_MINUTES bounds so it can never submit a value
 *     the API route's own bounds check would reject.
 * Both paths funnel into the same `handleCreate`, so the success screen
 * below (auto-copy, "Join the meeting now," etc.) behaves identically either
 * way.
 *
 * Collapsed by default: the manual-minutes field, its hint text, and the
 * "Create Qwickword" button only exist to serve the custom-duration path —
 * for anyone just clicking a preset (the common case), all three are dead
 * weight sitting on the page for no reason. They're hidden behind a single
 * discreet "custom" toggle, styled like a plain caption rather than a real
 * button so it doesn't compete with the presets. Clicking it expands the
 * same fields that would otherwise always be there — nothing about the
 * custom-duration mechanism itself changes, only whether it's visible
 * before someone asks for it.
 */
export default function CreateLinkForm() {
  // Deliberately blank, not pre-filled — the presets already cover the
  // common durations, so pre-filling this field would just be redundant
  // with them. The disabled-button colour issue this might tempt someone to
  // work around by pre-filling a value is fixed on the button itself
  // instead — see the Create button's className.
  const [minutesInput, setMinutesInput] = useState<string>("");
  const [state, setState] = useState<CreateState>({ status: "idle" });
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [copied, setCopied] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether the custom-duration section (manual minutes field + its hint +
  // the "Create Qwickword" button) is expanded — see this file's top
  // comment. Starts collapsed; the "custom" toggle below is the only way in.
  const [showCustom, setShowCustom] = useState(false);
  const minutesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Send focus straight to the minutes field the moment it expands — anyone
  // who clicked "custom" is about to type a number, so this saves them a
  // second click and makes the reveal feel purposeful rather than just
  // decorative.
  useEffect(() => {
    if (showCustom) minutesInputRef.current?.focus();
  }, [showCustom]);

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
        {/* In-flow, not `fixed` — a fixed position at the viewport top would
            overlap the page's own "Qwickword" heading above this card.
            Sitting in the normal layout right above the "ready" line keeps
            it near the action without ever covering unrelated content,
            regardless of viewport size.

            Always rendered, faded in/out via opacity rather than
            mounted/unmounted. Conditionally rendering it reserved no space
            while hidden, so the rest of the success screen
            visibly jumped up the instant the toast's 2.5s timer unmounted
            it. Keeping the element always in the DOM (just invisible)
            reserves its height permanently, so nothing below it ever
            moves. */}
        <div
          role="status"
          aria-hidden={!showCopiedToast}
          className={`rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-opacity duration-200 dark:bg-emerald-500 ${
            showCopiedToast ? "opacity-100" : "invisible opacity-0"
          }`}
        >
          Link copied to clipboard!
        </div>
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
            className="shrink-0 cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <Link
          href={state.roomPath}
          className="flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Join the meeting now
        </Link>
        <button
          type="button"
          onClick={() => {
            setState({ status: "idle" });
            setCopied(false);
            setShowCopiedToast(false);
            // Back to the simple, presets-only view — not left expanded
            // from whatever this tab did last time (see this file's top
            // comment on why collapsed is the default state to return to).
            setShowCustom(false);
            setMinutesInput("");
          }}
          className="cursor-pointer text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
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
            // A genuinely white fill (bg-white), not bg-zinc-50, since this
            // page's own background is bg-zinc-50 and would otherwise read
            // as almost no contrast — same idea as the solid black/white
            // buttons elsewhere on this page. `cursor-pointer` is explicit
            // because Tailwind v4 no longer defaults `<button>` to
            // `cursor: pointer` the way earlier versions did (a deliberate
            // upstream change to match native browser behaviour), so every
            // custom button in this app needs the utility set explicitly —
            // added here and swept across every other button below. Fixed
            // `w-20` (rather than a content-driven `min-w-14`) keeps every
            // preset the same size regardless of label length ("1 min" vs.
            // "20 min"); flex items-center/justify-center keeps the
            // (already-uniform text-sm) label centered inside it either way.
            //
            // White means white in both light and dark mode: dark:bg-white
            // with dark:text-zinc-900, matching the solid-color buttons
            // already used elsewhere in dark mode on this page, rather than
            // the near-black pill with light text a naive dark: override
            // would otherwise produce.
            className="flex h-11 w-20 cursor-pointer items-center justify-center rounded-full border border-black/[.08] bg-white px-2 text-sm font-medium text-zinc-900 transition-colors hover:border-black/[.3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:bg-white dark:text-zinc-900 dark:hover:border-black/[.3]"
          >
            {formatDuration(seconds)}
          </button>
        ))}
      </div>
      {/* Collapsed default: a single discreet toggle (see this file's top
          comment for why). Only shown while collapsed; expanding replaces
          it with the fields below rather than leaving a now-redundant
          toggle sitting above them. */}
      {!showCustom && (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="cursor-pointer text-xs text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-600 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          custom
        </button>
      )}

      {/* Smooth height reveal via the CSS grid-rows trick (0fr -> 1fr),
          rather than a hard show/hide, so the box visibly expands down
          instead of just appearing. `overflow-hidden` on the inner
          wrapper is what makes the 0fr state actually clip to zero height;
          the fields themselves are unchanged from before this redesign,
          just no longer visible (and, via aria-hidden, no longer announced)
          until expanded. */}
      <div
        className={`grid w-full transition-[grid-template-rows] duration-300 ease-out ${
          showCustom ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            aria-hidden={!showCustom}
            className="flex w-full flex-col items-center gap-4 pt-1"
          >
            <label htmlFor="duration-minutes" className="sr-only">
              Custom call length in minutes
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={minutesInputRef}
                id="duration-minutes"
                type="number"
                inputMode="numeric"
                min={MIN_DURATION_MINUTES}
                max={MAX_DURATION_MINUTES}
                step={1}
                value={minutesInput}
                onChange={(event) => setMinutesInput(event.target.value)}
                disabled={isLoading || !showCustom}
                tabIndex={showCustom ? 0 : -1}
                aria-label="Call length in minutes"
                aria-describedby="duration-hint"
                aria-invalid={!isValidDuration}
                className="w-24 rounded-full border border-black/[.08] bg-zinc-50 px-4 py-2 text-center text-lg font-medium tabular-nums text-zinc-900 outline-none focus:border-black/[.3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/[.4] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-base text-zinc-600 dark:text-zinc-400">min</span>
            </div>
            <p id="duration-hint" className="text-xs text-zinc-400 dark:text-zinc-500">
              {MIN_DURATION_MINUTES}–{MAX_DURATION_MINUTES} minutes, whole
              minutes only.
            </p>
            {/* Deliberately no `disabled:opacity-*`/colour change here — this
                button stays one color always, never dimming or shifting
                shade. The field above starts empty on purpose, so this
                button IS actually `disabled` while invalid
                — that state is communicated only by
                `disabled:cursor-not-allowed` and the hint text, not by
                dimming the button's own colour. */}
            <button
              type="submit"
              disabled={isLoading || !isValidDuration || !showCustom}
              tabIndex={showCustom ? 0 : -1}
              className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white transition-colors hover:enabled:bg-zinc-800 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:enabled:bg-zinc-200"
            >
              {isLoading ? "Creating…" : "Create Qwickword"}
            </button>
          </div>
        </div>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
