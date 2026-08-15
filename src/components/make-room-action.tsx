"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The secondary action on the home page: make a room instead of a one-off link.
 *
 * Deliberately small and second. A one-off Qwickword stays one tap, because the
 * thing the product is fastest at is a stranger talking with nothing installed
 * and no account. A room is the answer to a different question — *"I speak to
 * this person regularly"* — and it should not compete with the first.
 *
 * Until this existed, rooms could only be created from the iPhone app, which
 * makes an unshipped app the only door to a shipped feature.
 *
 * The new room's owner key comes back once from `POST /api/r`, and is handed
 * onward in the URL **fragment**. The room page claims it from there, stores it
 * and strips it from the address bar — see lib/owner-key-client.ts. Putting it
 * in a query string instead would write it into server logs and `Referer`
 * headers on the way.
 */
export default function MakeRoomAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRoom = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/r", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Five minutes, the middle preset. The room page lets this be changed
        // immediately, so asking for it here would be a question before the
        // thing exists.
        body: JSON.stringify({
          // Keep new rooms at five minutes even when temporary test presets
          // are inserted at the front of the one-tap list.
          defaultDurationSeconds: 300,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.slug || !payload?.ownerKey) {
        setError(payload?.error ?? "Couldn't create the room.");
        setBusy(false);
        return;
      }
      router.push(`/r/${payload.slug}#k=${payload.ownerKey}`);
    } catch {
      setError("No connection. Check your network and try again.");
      setBusy(false);
    }
  }, [busy, router]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void makeRoom()}
        disabled={busy}
        className="cursor-pointer text-[13px] text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {busy ? "Making a room…" : "Or make a room you can come back to"}
      </button>
      {error && (
        <p role="alert" className="text-[13px] text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
