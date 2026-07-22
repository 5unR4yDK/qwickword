"use client";

// v2 call UI preview — a trimmed-down create form pointing at /test/[room]
// instead of the production home page's create-link-form.tsx (which points
// at /[room]). No clipboard auto-copy, no manual-minutes field — this is a
// preview harness, not the real create flow; keeping it minimal avoids
// duplicating logic that isn't the point of this page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DURATION_PRESETS_SECONDS, formatDuration } from "@/lib/duration";

type CreateRoomResponse = {
  name: string;
  exp: number;
  durationSeconds: number;
  mockMode: boolean;
};

export default function TestCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(durationSeconds: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
      const data = (await response.json()) as CreateRoomResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status}).`);
      }
      if (data.mockMode) {
        throw new Error(
          "No live Daily connection configured — the v2 preview needs real credentials, not mock mode."
        );
      }
      router.push(`/test/${data.name}?exp=${data.exp}&d=${data.durationSeconds}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a preview room.");
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
      <div
        role="group"
        aria-label="Preview durations"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {DURATION_PRESETS_SECONDS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            disabled={loading}
            onClick={() => void handleCreate(seconds)}
            className="flex h-11 min-w-14 items-center justify-center rounded-full border border-white/15 bg-zinc-900 px-4 text-sm font-medium text-zinc-100 transition-colors hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formatDuration(seconds)}
          </button>
        ))}
      </div>
      {loading && <p className="text-sm text-zinc-500">Creating a preview room…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
