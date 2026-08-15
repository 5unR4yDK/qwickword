"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Share2 } from "lucide-react";
import {
  DURATION_PRESETS_SECONDS,
  formatDuration,
  formatDurationAdjective,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@/lib/duration";
import MakeRoomAction from "./make-room-action";
import { SignInLink } from "./sign-in";

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
      /** Slug only — needed to attribute a deliberate share to this call. */
      roomName: string;
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
 *     clickable). Enter or the arrow button submits; Escape, or a click
 *     anywhere else on the page, reverts to the plain pill.
 */
export default function CreateLinkForm({ mockMode }: { mockMode: boolean }) {
  const [state, setState] = useState<CreateState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);
  const customFieldRef = useRef<HTMLDivElement>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  function clientAttribution() {
    const params = new URLSearchParams(window.location.search);
    return {
      attribution: {
        source: params.get("utm_source"),
        medium: params.get("utm_medium"),
        campaign: params.get("utm_campaign"),
        content: params.get("utm_content"),
      },
    };
  }

  useEffect(() => {
    const capabilityCheck = setTimeout(
      () => setCanNativeShare(typeof navigator.share === "function"),
      0
    );
    void fetch("/api/attribution/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientAttribution()),
      keepalive: true,
    }).catch(() => {});
    return () => clearTimeout(capabilityCheck);
  }, []);

  // Focus the inline field the moment the custom pill morphs into it —
  // whoever clicked is about to type a number.
  useEffect(() => {
    if (customOpen) customInputRef.current?.focus();
  }, [customOpen]);

  // Clicking anywhere else on the page reverts the field to the plain pill,
  // the same as Escape. Listening on pointerdown rather than click means the
  // revert happens as the press lands, so it still fires when the press ends
  // outside the window, and it beats the input's own blur. The arrow button
  // lives inside this container, so submitting is not treated as an outside
  // click.
  useEffect(() => {
    if (!customOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (customFieldRef.current?.contains(event.target as Node)) return;
      setCustomOpen(false);
      setCustomValue("");
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [customOpen]);

  const parsedMinutes = Number(customValue);
  const isValidDuration =
    customValue.trim() !== "" &&
    Number.isInteger(parsedMinutes) &&
    parsedMinutes >= MIN_DURATION_MINUTES &&
    parsedMinutes <= MAX_DURATION_MINUTES;
  // Only the over-the-max case gets a warning — typing "0" or leaving it
  // blank isn't wrong yet, it's just incomplete. Absolutely positioned (see
  // below) so it never pushes the pills around when it appears/disappears.
  const isOverMax =
    customValue.trim() !== "" &&
    Number.isFinite(parsedMinutes) &&
    parsedMinutes > MAX_DURATION_MINUTES;

  const isLoading = state.status === "loading";

  async function handleCreate(durationSeconds: number) {
    setState({ status: "loading" });
    setCopied(false);

    let response: Response;
    try {
      response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds, ...clientAttribution() }),
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
      roomName: room.name,
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

  /**
   * Stats only (see src/lib/db.ts): the link was deliberately sent somewhere.
   * Fire-and-forget — never let a stats ping affect sharing.
   *
   * Deliberately NOT called from the auto-copy on creation. That runs for
   * every call, so counting it would mark every link as shared and measure
   * nothing. Only an explicit press counts.
   */
  function reportShared(
    roomName: string,
    via: "native" | "copy" | "email"
  ) {
    if (mockMode) return;
    void fetch(`/api/rooms/${encodeURIComponent(roomName)}/shared`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ via }),
      keepalive: true,
    }).catch(() => {});
  }

  async function handleCopy(link: string, roomName: string) {
    reportShared(roomName, "copy");
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleNativeShare(
    link: string,
    roomName: string,
    durationSeconds: number
  ) {
    const duration = formatDurationAdjective(durationSeconds);
    try {
      await navigator.share({
        title: `Qwickword: a ${duration} call`,
        text: `Join me for a ${duration} Qwickword. It ends when the timer does.`,
        url: link,
      });
      reportShared(roomName, "native");
    } catch {
      // Closing the share sheet or a platform share failure is not intent
      // completed, so it must not be counted as a share.
    }
  }

  /* ------------------------------------------------------------------ */
  /* Link created (6b)                                                   */
  /* ------------------------------------------------------------------ */
  if (state.status === "success") {
    const duration = formatDurationAdjective(state.durationSeconds);
    const mailSubject = encodeURIComponent(
      `Qwickword: a ${duration} call`
    );
    const mailBody = encodeURIComponent(
      `Join me for a ${duration} Qwickword. It ends when the timer does:\n\n${state.link}`
    );

    return (
      <div className="flex w-full max-w-[720px] flex-col items-center gap-9 text-center">
        <Wordmark className="w-[260px] max-w-[70vw] opacity-85" />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="flex h-6 items-center rounded-full bg-[rgba(61,254,241,0.14)] px-2.5 text-xs font-semibold tracking-[0.06em] text-teal-700 dark:text-[#3DFEF1]">
            {formatDuration(state.durationSeconds).toUpperCase()}
          </span>
          <span className="text-sm text-zinc-500 dark:text-[#71717A]">
            hard stop, no extend button
          </span>
        </div>

        {state.mockMode && (
          <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Mock mode: this link is simulated, not a real call yet.
          </p>
        )}

        <div className="flex w-full flex-col items-center gap-4">
          <h1 className="text-[13px] font-medium tracking-[0.18em] text-zinc-500 uppercase dark:text-[#71717A]">
            Share this link
          </h1>
          <div className="flex w-full flex-col items-center gap-3.5 rounded-3xl border border-teal-600/40 bg-teal-500/[0.06] px-8 py-7 dark:border-[rgba(61,254,241,0.3)] dark:bg-[rgba(61,254,241,0.04)]">
            <p className="text-3xl font-medium break-all text-teal-700 dark:text-[#3DFEF1]">
              {state.displayLink}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canNativeShare && (
                <button
                  type="button"
                  onClick={() =>
                    void handleNativeShare(
                      state.link,
                      state.roomName,
                      state.durationSeconds
                    )
                  }
                  className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-[#3DFEF1] px-5 text-sm font-semibold text-[#062B28] transition-colors duration-150 hover:bg-[#7FFFF5]"
                >
                  <Share2 size={16} aria-hidden="true" /> Share
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopy(state.link, state.roomName)}
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
                onClick={() => reportShared(state.roomName, "email")}
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
        <h1 className="text-sm font-medium tracking-[0.26em] text-zinc-600 uppercase dark:text-[#D9D9D9]">
          Meetings that end on time
        </h1>
      </div>

      {mockMode && (
        <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Mock mode: no Daily API key configured
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
               flush with the presets beside it. relative + the absolutely
               positioned warning below is deliberate: the warning must not
               participate in layout, or its appearance/disappearance while
               typing shifts the whole picker row up and down. */
            <div
              ref={customFieldRef}
              className="relative box-border flex h-11 items-center gap-2 rounded-full border border-teal-600 bg-teal-500/[0.08] py-0 pr-1 pl-4 focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 focus-within:ring-offset-zinc-50 dark:border-[#3DFEF1] dark:bg-[rgba(61,254,241,0.08)] dark:focus-within:ring-[#3DFEF1] dark:focus-within:ring-offset-black"
            >
              {isOverMax && (
                <p
                  id="custom-duration-warning"
                  role="alert"
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-medium whitespace-nowrap text-red-400/80 dark:text-red-400/70"
                >
                  Max {MAX_DURATION_MINUTES} min
                </p>
              )}
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
                aria-describedby={isOverMax ? "custom-duration-warning" : undefined}
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
        {/* Second, and quiet. A one-off Qwickword stays one tap; a room answers
            a different question and must not compete with it. */}
        <MakeRoomAction />
        {/* Quieter still. Signing in is never why anyone came here, and the
            whole product works without it. */}
        <SignInLink />
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
  const linkClass =
    "transition-colors hover:text-zinc-600 dark:hover:text-zinc-400";

  return (
    <nav className="flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
      <Link href="/how-qwickword-works" className={linkClass}>
        how it works
      </Link>
      <span aria-hidden="true" className="h-[11px] w-px bg-zinc-300 dark:bg-[#3F3F46]" />
      <Link href="/manifesto" className={linkClass}>
        manifesto
      </Link>
      <span aria-hidden="true" className="h-[11px] w-px bg-zinc-300 dark:bg-[#3F3F46]" />
      <Link href="/about" className={linkClass}>
        about
      </Link>
      <span aria-hidden="true" className="h-[11px] w-px bg-zinc-300 dark:bg-[#3F3F46]" />
      <Link href="/about#privacy" className={linkClass}>
        privacy
      </Link>
      <span aria-hidden="true" className="h-[11px] w-px bg-zinc-300 dark:bg-[#3F3F46]" />
      <a
        href="https://www.youtube.com/@Qwickword"
        className={linkClass}
        aria-label="Qwickword on YouTube"
      >
        YouTube
      </a>
      <span aria-hidden="true" className="h-[11px] w-px bg-zinc-300 dark:bg-[#3F3F46]" />
      <a href="mailto:info@mauriceholdings.llc" className={linkClass}>
        support
      </a>
    </nav>
  );
}
