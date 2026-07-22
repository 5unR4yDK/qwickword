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
 * Collapsed by default (2026-07-22, Andreas, interactive: "the whole custom
 * link section and the button that says Create Quick Word is providing a
 * lot of bulk and actually it takes away from the simplicity of the front
 * page... only when you click the custom link does the entire box set
 * expand down and let you put in the minutes and introduces you to the
 * create button"). The manual-minutes field, its hint text, and the "Create
 * Qwickword" button only exist to serve the custom-duration path — for
 * anyone just clicking a preset (the common case), all three were dead
 * weight sitting on the page for no reason. Now they're hidden behind a
 * single discreet toggle, styled exactly like the old always-visible
 * "or pick a custom length" caption used to be (Andreas: "it should be in
 * the same text as you have now for the text that says or pick a custom
 * link so it's discrete it's not imposing"), just relabelled to the single
 * word "custom" and made clickable. Clicking it expands the same fields that
 * used to always be there — nothing about the custom-duration mechanism
 * itself changed, only whether it's visible before someone asks for it.
 */
export default function CreateLinkForm({
  basePath = "",
}: {
  /**
   * Prefix for the generated call link's path — "" (default) for the real
   * flow (`/[room]`), "/test" for the v2 call UI preview
   * (`/test/[room]`). Added 2026-07-22 (Andreas, interactive: "those two
   * pages should be completely identical in both functionalities and in
   * UI... everything from creating it to the confirmation to all
   * everything") so the v2 preview's landing page can reuse this exact
   * component — same styling, same validation, same success screen — rather
   * than a hand-rolled duplicate that could quietly drift from the real one.
   * Every other line of behaviour here is identical regardless of basePath.
   */
  basePath?: string;
}) {
  // Deliberately blank, not pre-filled (2026-07-22, Andreas, interactive:
  // "we already have two minutes as an option [the preset button] and I
  // don't want that field to be pre filled" — correcting the previous
  // attempt at this same complaint, which pre-filled "2" here specifically
  // to dodge the disabled-button colour issue below. The real fix for that
  // is on the button itself, not this field — see the Create button's
  // className.
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
    const roomPath = `${basePath}/${room.name}?exp=${room.exp}&d=${room.durationSeconds}`;
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
        {/* In-flow, not `fixed` (was fixed to the viewport top, which
            overlapped the page's own "Qwickword" heading above this card —
            Andreas flagged this 2026-07-21). Sitting in the normal layout
            right above the "ready" line keeps it near the action without
            ever covering unrelated content, regardless of viewport size.

            Always rendered now, faded in/out via opacity rather than
            mounted/unmounted (2026-07-22, Andreas: "the green clipboard
            message pushes down the content because when it disappears it
            makes the content reorient back up"). Conditionally rendering it
            reserved no space while hidden, so the rest of the success screen
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
            // from whatever this tab did last time (2026-07-22, Andreas,
            // interactive — see this file's top comment on why collapsed is
            // the default state to return to).
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
            // 2026-07-22, Andreas, interactive, three fixes in one:
            // (1) "in the white style that you had before... a little bit
            // more contrast" — bg-zinc-50 on this page's own bg-zinc-50
            // background had essentially zero contrast; a genuinely white
            // fill (bg-white) reads clearly against it, same idea as the
            // solid black/white buttons elsewhere on this page.
            // (2) "my cursor just stays an arrow... it has to turn into a
            // button presser" — Tailwind v4 no longer defaults `<button>`
            // to `cursor: pointer` the way earlier versions did (a
            // deliberate upstream change to match native browser
            // behaviour), so every custom button in this app needs the
            // utility explicitly now — added here and swept across every
            // other button below.
            // (3) "an equal size button for each of the minutes settings...
            // all be the same size... as long as the text is perfectly
            // centered in the middle it's OK" — replaced the old
            // content-driven `min-w-14` (which let "1 min" and "20 min"
            // render at different widths) with a fixed `w-20`, same for
            // every preset regardless of label length; flex
            // items-center/justify-center keeps the (already-uniform
            // text-sm) label centered inside it either way.
            className="flex h-11 w-20 cursor-pointer items-center justify-center rounded-full border border-black/[.08] bg-white px-2 text-sm font-medium text-zinc-900 transition-colors hover:border-black/[.3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-white/[.4]"
          >
            {formatDuration(seconds)}
          </button>
        ))}
      </div>
      {/* Collapsed default: a single discreet toggle, same styling as the
          old always-visible "or pick a custom length" caption (2026-07-22,
          Andreas, interactive — see this file's top comment). Only shown
          while collapsed; expanding replaces it with the fields below rather
          than leaving a now-redundant toggle sitting above them. */}
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
          rather than a hard show/hide — Andreas asked for the box to
          "expand down," not just appear. `overflow-hidden` on the inner
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
            {/* Deliberately no `disabled:opacity-*`/colour change here
                (2026-07-22, Andreas, interactive, earlier this session: "the
                button should just be 1 color and should never change
                color... make sure that button never changes color it just
                stays white all the time"). The field above starts empty on
                purpose, so this button IS actually `disabled` while invalid
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
