"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimOwnerKey, ownerLink } from "@/lib/owner-key-client";
// `room-view`, not `rooms`: the latter reaches the database and would pull
// Postgres into the browser bundle.
import { callOutcome, type RoomView } from "@/lib/room-view";
import { DURATION_PRESETS_SECONDS, formatDuration } from "@/lib/duration";

/**
 * The room landing page.
 *
 * Entering a room starts nothing. You land here, see what the room is and how
 * long its calls run, and choose to start one — which is the difference between
 * a room and a call link. A room link that rang someone the moment it was
 * opened would be unusable in an email signature, which is exactly where this
 * link is meant to live.
 *
 * Everything here is visible to whoever holds the link: the name, the default
 * length, and the timeline of past calls. Files are not, and are not fetched;
 * the locked card is a statement of what exists, not a hidden list.
 */
export default function RoomPage({ room }: { room: RoomView }) {
  const router = useRouter();
  const [starting, setStarting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ownerCopied, setOwnerCopied] = useState(false);
  // Undefined while the fragment is still being claimed, so the management
  // controls do not flash in and out on first paint.
  const [ownerKey, setOwnerKey] = useState<string | null | undefined>(undefined);

  // Claims the key from `#k=…` if it is there, stores it, and strips it from
  // the address bar so copying the URL shares the room without handing over
  // control of it.
  useEffect(() => {
    setOwnerKey(claimOwnerKey(room.slug));
  }, [room.slug]);

  const shareUrl = `https://qwickword.com/r/${room.slug}`;
  const title = room.name ?? room.slug.replace(/-/g, " ");
  const others = DURATION_PRESETS_SECONDS.filter(
    (seconds) => seconds !== room.defaultDurationSeconds
  );

  const startCall = useCallback(
    async (durationSeconds: number) => {
      if (starting !== null) return;
      setStarting(durationSeconds);
      setError(null);
      try {
        const response = await fetch(`/api/r/${room.slug}/calls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationSeconds }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload?.error ?? "Couldn't start the call.");
          setStarting(null);
          return;
        }
        // Straight into the call, which behaves exactly as any other
        // Qwickword: fresh Daily room, hard expiry, no extension.
        router.push(
          payload.clean
            ? `/${payload.name}`
            : `/${payload.name}?exp=${payload.exp}&d=${payload.durationSeconds}`
        );
      } catch {
        setError("No connection. Check your network and try again.");
        setStarting(null);
      }
    },
    [room.slug, router, starting]
  );

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* a clipboard the browser refuses is not worth an error message */
    }
  }, [shareUrl]);

  const copyOwnerLink = useCallback(async () => {
    if (!ownerKey) return;
    try {
      await navigator.clipboard.writeText(ownerLink(room.slug, ownerKey));
      setOwnerCopied(true);
      setTimeout(() => setOwnerCopied(false), 1200);
    } catch {
      /* see copyLink */
    }
  }, [ownerKey, room.slug]);

  return (
    <div className="relative flex flex-1 justify-center overflow-hidden bg-zinc-50 px-6 py-16 dark:bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.09)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen"
      />

      <div className="relative z-10 flex w-full max-w-xl flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <Link href="/" aria-label="Qwickword home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/wordmark-only.svg"
              alt="qwickword.com"
              className="hidden h-auto w-[200px] max-w-[60vw] dark:block"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/wordmark-only-black.svg"
              alt="qwickword.com"
              className="h-auto w-[200px] max-w-[60vw] dark:hidden"
            />
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatDuration(room.defaultDurationSeconds)} by default
          </p>
        </header>

        <section className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void startCall(room.defaultDurationSeconds)}
            disabled={starting !== null}
            className="w-full rounded-full bg-[#3DFEF1] px-6 py-4 text-base font-semibold text-[#062B28] transition hover:opacity-90 disabled:opacity-50"
          >
            {starting === room.defaultDurationSeconds
              ? "Starting…"
              : "Start a call"}
          </button>

          <div
            className="flex flex-wrap justify-center gap-1"
            aria-label="Other call lengths"
          >
            {others.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => void startCall(seconds)}
                disabled={starting !== null}
                className="min-h-11 rounded-full px-4 text-sm text-zinc-500 transition hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-white"
              >
                {starting === seconds ? "…" : formatDuration(seconds)}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm break-words text-[#0E9E93] dark:text-[#3DFEF1]">
            qwickword.com/r/{room.slug}
          </p>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="min-h-11 rounded-full px-3 text-sm font-medium text-[#0E9E93] dark:text-[#3DFEF1]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            This link always works. It opens the room, it doesn&apos;t ring
            anyone.
          </p>
        </section>

        {/* Only while this browser holds the key. It cannot be fetched from the
            server, so this is the only place to get it back. */}
        {ownerKey && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {ownerCopied ? "Owner link copied" : "Owner link"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Private. Anyone with it can rename or close this room. Keep it
              somewhere safe — it can&apos;t be recovered.
            </p>
            <button
              type="button"
              onClick={() => void copyOwnerLink()}
              className="mt-2 min-h-11 rounded-full px-3 text-sm font-medium text-[#0E9E93] dark:text-[#3DFEF1]"
            >
              {ownerCopied ? "Copied" : "Copy owner link"}
            </button>
          </section>
        )}

        {ownerKey === null && (
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            You don&apos;t have the owner key for this room in this browser.
            Calls still work and the link still opens. It can&apos;t be renamed
            or closed, and it expires on its own after 90 days without a call.
          </p>
        )}

        <section aria-labelledby="timeline-heading" className="flex flex-col gap-2">
          <h2
            id="timeline-heading"
            className="text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400"
          >
            Room timeline
          </h2>

          {/* Files are profile-gated and not built yet. The card states that
              plainly rather than pretending the section does not exist. */}
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <span aria-hidden="true" className="text-zinc-400">
              &#128274;
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                Room files are private
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Sharing files needs a profile, which isn&apos;t built yet. Calls
                never require one.
              </span>
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs tracking-widest text-zinc-400 uppercase">
              Calls
            </span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {room.calls.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No calls yet. Starting one will add it here.
            </p>
          ) : (
            <ul className="flex flex-col">
              {room.calls.map((call) => {
                const outcome = callOutcome(call);
                return (
                  <li
                    key={call.callName}
                    className="flex min-h-14 items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800"
                  >
                    <span className="flex flex-col">
                      <span className="text-sm text-zinc-900 dark:text-white">
                        {new Date(call.createdAt).toLocaleString(undefined, {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDuration(call.durationSeconds)}
                      </span>
                    </span>
                    <span
                      className={
                        outcome === "never started"
                          ? "text-sm text-amber-500"
                          : "text-sm text-zinc-500 dark:text-zinc-400"
                      }
                    >
                      {outcome}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
