"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
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
  /**
   * Whether the server recorded this room's duration, making the clean
   * (slug-only) link resolvable — see POST /api/rooms. False means the link
   * must carry `exp`/`d` in its query string to work.
   */
  clean: boolean;
};

type CreateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      link: string;
      displayLink: string;
      roomPath: string;
      mockMode: boolean;
      durationSeconds: number;
    };

/**
 * The whole front-page flow: wordmark, tagline, duration picker, and — once
 * a room exists — the link-created screen. This component owns the full
 * centred column (not just the form controls) because creating a link
 * changes the entire layout: the wordmark shrinks, the picker disappears,
 * and the link card takes over as the largest element on screen.
 *
 * Duration picking has two paths that both funnel into `handleCreate`:
 *  1. Preset pills — one click creates the room at that length.
 *  2. The `custom` pill, which morphs in place into an inline minutes field
 *     (nothing above or below moves; the other pills dim but stay
 *     clickable). Enter or the arrow button submits; Escape reverts to the
 *     plain pill.
 */
export default function CreateLinkForm({ mockMode }: { mockMode: boolean }) {
  const [state, setState] = useState<CreateState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);

  // Focus the inline field the moment the custom pill morphs into it —
  // whoever clicked is about to type a number.
  useEffect(() => {
    if (customOpen) customInputRef.current?.focus();
  }, [customOpen]);

  const parsedMinutes = Number(customValue);
  const isValidDuration =
    customValue.trim() !== "" &&
    Number.isInteger(parsedMinutes) &&
    parsedMinutes >= MIN_DURATION_MINUTES &&
    parsedMinutes <= MAX_DURATION_MINUTES;

  const isLoading = state.status === "loading";

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
    // The shared link is clean — just the slug — whenever the server
    // confirmed it recorded the duration (the call page recovers everything
    // else from Daily + that record). If it couldn't (`clean: false`:
    // database hiccup, or mock mode), `exp`/`d` ride along in the query
    // string instead, which needs no lookup at all. `exp` here is the
    // room's *pre-start* buffer, not the real call length — the countdown
    // starts when the second person joins.
    const roomPath = room.clean
      ? `/${room.name}`
      : `/${room.name}?exp=${room.exp}&d=${room.durationSeconds}`;
    const link = `${window.location.origin}${roomPath}`;
    const displayLink = `${window.location.host}/${room.name}`;

    setState({
      status: "success",
      link,
      displayLink,
      roomPath,
      mockMode: room.mockMode,
      durationSeconds: room.durationSeconds,
    });

    // Best-effort auto-copy: the card's button shows the post-copy state on
    // success and falls back to an active "Copy link" if the clipboard
    // write fails (insecure context, Safari's spent user-activation, etc.).
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function handleCustomSubmit() {
    if (!isValidDuration || isLoading) return;
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

  /* ------------------------------------------------------------------ */
  /* Link created (6b)                                                   */
  /* ------------------------------------------------------------------ */
  if (state.status === "success") {
    const minutes = Math.round(state.durationSeconds / 60);
    const mailSubject = encodeURIComponent(
      `Qwickword — a ${minutes} minute call`
    );
    const mailBody = encodeURIComponent(
      `Join me for a ${minutes} minute Qwickword. It ends when the timer does:\n\n${state.link}`
    );

    return (
      <div className="flex w-full max-w-[720px] flex-col items-center gap-9 text-center">
        <Wordmark className="w-[260px] max-w-[70vw] opacity-85" />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="flex h-6 items-center rounded-full bg-[rgba(61,254,241,0.14)] px-2.5 text-xs font-semibold tracking-[0.06em] text-teal-700 dark:text-[#3DFEF1]">
            {minutes} MIN
          </span>
          <span className="text-sm text-zinc-500 dark:text-[#71717A]">
            hard stop, no extend button
          </span>
        </div>

        {state.mockMode && (
          <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Mock mode — this link is simulated, not a real call yet.
          </p>
        )}

        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-[13px] font-medium tracking-[0.18em] text-zinc-500 uppercase dark:text-[#71717A]">
            Share this link
          </p>
          <div className="flex w-full flex-col items-center gap-3.5 rounded-3xl border border-teal-600/40 bg-teal-500/[0.06] px-8 py-7 dark:border-[rgba(61,254,241,0.3)] dark:bg-[rgba(61,254,241,0.04)]">
            <p className="text-3xl font-medium break-all text-teal-700 dark:text-[#3DFEF1]">
              {state.displayLink}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(state.link)}
                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-teal-600/60 px-5 text-sm font-medium text-teal-700 transition-colors duration-150 hover:bg-teal-500/10 dark:border-[rgba(61,254,241,0.45)] dark:text-[#3DFEF1] dark:hover:bg-[rgba(61,254,241,0.08)]"
              >
                {copied ? (
                  <>
                    <Check size={16} aria-hidden="true" /> Copied
                  </>
                ) : (
                  "Copy link"
                )}
              </button>
              <a
                href={`mailto:?subject=${mailSubject}&body=${mailBody}`}
                className="flex h-11 items-center rounded-full border border-black/[.145] px-5 text-sm font-medium text-zinc-600 transition-colors duration-150 hover:border-black/[.3] dark:border-white/[.145] dark:text-[#A1A1AA] dark:hover:border-white/[.3]"
              >
                Email it
              </a>
            </div>
          </div>
        </div>

        <Link
          href={state.roomPath}
          className="flex h-[46px] items-center rounded-full bg-[#3DFEF1] px-[26px] text-sm font-semibold text-[#062B28] transition-colors duration-150 hover:bg-[#7FFFF5]"
        >
          Join the meeting now
        </Link>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setState({ status: "idle" });
              setCopied(false);
              setCustomOpen(false);
              setCustomValue("");
            }}
            className="cursor-pointer text-[13px] text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-700 dark:text-[#71717A] dark:hover:text-zinc-400"
          >
            Create another
          </button>
          <FooterLinks />
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Front page (4a) + custom open (5a)                                  */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex w-full max-w-[720px] flex-col items-center gap-11 text-center">
      <div className="flex flex-col items-center gap-5">
        <Wordmark className="w-[540px] max-w-[86vw]" />
        <p className="text-sm font-medium tracking-[0.26em] text-zinc-600 uppercase dark:text-[#D9D9D9]">
          This meeting could&apos;ve been a Qwickword
        </p>
      </div>

      {mockMode && (
        <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Mock mode — no Daily API key configured
        </p>
      )}

      <div className="flex w-full flex-col items-center gap-4">
        <p className="text-sm font-medium text-zinc-500 dark:text-[#71717A]">
          How long is your Qwickword?
        </p>

        <div
          role="group"
          aria-label="Call length"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {DURATION_PRESETS_SECONDS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              disabled={isLoading}
              onClick={() => handleCreate(seconds)}
              className={`flex h-11 w-20 cursor-pointer items-center justify-center rounded-full border text-sm font-medium transition-colors duration-150 hover:border-[#3DFEF1] hover:bg-[#3DFEF1] hover:text-[#062B28] disabled:cursor-not-allowed disabled:opacity-60 ${
                customOpen
                  ? "border-teal-600/25 text-teal-700/60 dark:border-[rgba(61,254,241,0.25)] dark:text-[rgba(61,254,241,0.6)]"
                  : "border-teal-600/50 text-teal-700 dark:border-[rgba(61,254,241,0.45)] dark:text-[#3DFEF1]"
              }`}
            >
              {formatDuration(seconds)}
            </button>
          ))}

          {customOpen ? (
            /* The dashed pill, morphed in place into the inline field —
               box-border keeps it exactly 44px tall including its border,
               flush with the presets beside it. */
            <div className="box-border flex h-11 items-center gap-2 rounded-full border border-teal-600 bg-teal-500/[0.08] py-0 pr-1 pl-4 dark:border-[#3DFEF1] dark:bg-[rgba(61,254,241,0.08)]">
              <label htmlFor="custom-minutes" className="sr-only">
                Custom call length in minutes
              </label>
              <input
                ref={customInputRef}
                id="custom-minutes"
                type="number"
                inputMode="numeric"
                min={MIN_DURATION_MINUTES}
                max={MAX_DURATION_MINUTES}
                step={1}
                value={customValue}
                onChange={(event) => setCustomValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCustomSubmit();
                  } else if (event.key === "Escape") {
                    setCustomOpen(false);
                    setCustomValue("");
                  }
                }}
                disabled={isLoading}
                aria-describedby="custom-hint"
                aria-invalid={customValue.trim() !== "" && !isValidDuration}
                className="w-10 bg-transparent text-[15px] font-medium text-teal-700 tabular-nums caret-teal-600 outline-none dark:text-[#3DFEF1] dark:caret-[#3DFEF1] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[13px] text-zinc-500 dark:text-[#8A8A8F]">
                min
              </span>
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={isLoading || !isValidDuration}
                aria-label="Create Qwickword"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#3DFEF1] text-[#062B28] transition-colors duration-150 hover:bg-[#7FFFF5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setCustomOpen(true)}
              className="flex h-11 w-20 cursor-pointer items-center justify-center rounded-full border border-dashed border-black/20 text-sm font-medium text-zinc-500 transition-colors duration-150 hover:border-teal-600/60 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:text-[#71717A] dark:hover:border-[rgba(61,254,241,0.55)] dark:hover:text-[#3DFEF1]"
            >
              custom
            </button>
          )}
        </div>

        {customOpen && (
          <p id="custom-hint" className="text-xs text-zinc-500 dark:text-[#52525B]">
            {MIN_DURATION_MINUTES}–{MAX_DURATION_MINUTES} minutes, whole minutes
            only. Enter creates the link.
          </p>
        )}

        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="text-[15px] leading-6 text-zinc-500 dark:text-[#71717A]">
          Set a time limit, share the link. When the timer hits zero, the call
          ends.
        </p>
        <FooterLinks />
      </div>
    </div>
  );
}

/** The cursive wordmark — cyan on dark, black on light. */
function Wordmark({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/wordmark-only.svg"
        alt="qwickword.com"
        className={`hidden h-auto dark:block ${className ?? ""}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/wordmark-only-black.svg"
        alt="qwickword.com"
        className={`h-auto dark:hidden ${className ?? ""}`}
      />
    </>
  );
}

function FooterLinks() {
  return (
    <nav className="flex items-center gap-3 text-xs text-zinc-400 dark:text-[#52525B]">
      <Link
        href="/manifesto"
        className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-400"
      >
        manifesto
      </Link>
      <span aria-hidden="true" className="h-[11px] w-px bg-zinc-300 dark:bg-[#3F3F46]" />
      <Link
        href="/about"
        className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-400"
      >
        about
      </Link>
    </nav>
  );
}
