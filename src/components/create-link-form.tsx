"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CUSTOM_DURATION_MINUTES_OPTIONS,
  DURATION_PRESETS_SECONDS,
  formatDuration,
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
 * The core create-link flow. Redesigned 2026-07-21 per Andreas (interactive)
 * to cut a click: rather than pick a duration, then press a separate
 * "Create" button, every duration control below — each preset button, and
 * the custom 1–60-minute dropdown — creates the room immediately on
 * click/select. There is no more idle "durationSeconds" selection state;
 * a click/select *is* the create action.
 *
 * On success the link is copied to the clipboard automatically (Andreas:
 * "the URL should automatically be copied... after you click that button"),
 * confirmed with a small auto-dismissing toast rather than a silent copy —
 * the manual "Copy link" button stays too, since clipboard writes can
 * silently fail in some browsers/contexts and the visible link is the
 * fallback. A "Join the meeting now" button was also added so a creator who
 * wants to jump straight in doesn't have to leave this page and paste their
 * own link back in.
 */
export default function CreateLinkForm() {
  const [state, setState] = useState<CreateState>({ status: "idle" });
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [copied, setCopied] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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
    // `exp` (the room's Unix expiry timestamp) rides along in the query
    // string so the call page (`/[room]`) can show a countdown without any
    // server-side lookup or database — see src/app/[room]/page.tsx.
    const roomPath = `/${room.name}?exp=${room.exp}`;
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
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Click to have a quick word:
      </p>
      <div
        role="group"
        aria-label="Have a quick word — pick a length to create and copy the link instantly"
        className="flex flex-wrap justify-center gap-2"
      >
        {DURATION_PRESETS_SECONDS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => handleCreate(seconds)}
            disabled={isLoading}
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-black/[.2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:text-zinc-300 dark:hover:border-white/[.3]"
          >
            {formatDuration(seconds)}
          </button>
        ))}
        <select
          aria-label="Custom length, in minutes"
          disabled={isLoading}
          defaultValue=""
          onChange={(event) => {
            const minutes = Number(event.target.value);
            if (minutes > 0) handleCreate(minutes * 60);
            event.currentTarget.value = "";
          }}
          className="rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-black/[.2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:text-zinc-300 dark:hover:border-white/[.3]"
        >
          <option value="" disabled>
            Custom…
          </option>
          {CUSTOM_DURATION_MINUTES_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min
            </option>
          ))}
        </select>
      </div>
      {isLoading && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Creating…</p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
