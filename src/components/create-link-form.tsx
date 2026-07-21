"use client";

import { useState } from "react";
import { DURATION_PRESETS_SECONDS, formatDuration } from "@/lib/duration";

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
  | { status: "success"; link: string; mockMode: boolean; durationSeconds: number };

const DEFAULT_DURATION_SECONDS = 120;

/**
 * The core create-link flow (Phase 0 item 4): pick a duration, create a
 * hard-expiry Daily room via POST /api/rooms, and show a copyable link.
 *
 * The shareable link points at this app's own `/{roomName}` path rather than
 * the raw Daily room URL, because the next roadmap item (Phase 0: "Call page
 * /[room]") is what will actually render the join experience and the hard
 * "Time's up" screen. That route doesn't exist yet, so a freshly created link
 * will 404 until that item is built — expected for tonight's scope, and
 * called out in STATUS.md.
 */
export default function CreateLinkForm() {
  const [durationSeconds, setDurationSeconds] = useState<number>(
    DEFAULT_DURATION_SECONDS
  );
  const [state, setState] = useState<CreateState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
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
    const link = `${window.location.origin}/${room.name}?exp=${room.exp}`;
    setState({
      status: "success",
      link,
      mockMode: room.mockMode,
      durationSeconds: room.durationSeconds,
    });
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can fail (e.g. insecure context, denied permission).
      // The link is still visible and selectable in the input, so this isn't
      // fatal — just don't claim success.
      setCopied(false);
    }
  }

  if (state.status === "success") {
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
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
        <button
          type="button"
          onClick={() => {
            setState({ status: "idle" });
            setCopied(false);
          }}
          className="text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        role="group"
        aria-label="Choose a duration"
        className="flex flex-wrap justify-center gap-2"
      >
        {DURATION_PRESETS_SECONDS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => setDurationSeconds(seconds)}
            aria-pressed={durationSeconds === seconds}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              durationSeconds === seconds
                ? "border-transparent bg-foreground text-background"
                : "border-black/[.08] text-zinc-700 hover:border-black/[.2] dark:border-white/[.145] dark:text-zinc-300 dark:hover:border-white/[.3]"
            }`}
          >
            {formatDuration(seconds)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleCreate}
        disabled={state.status === "loading"}
        className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {state.status === "loading" ? "Creating…" : "Create Qwickword"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
