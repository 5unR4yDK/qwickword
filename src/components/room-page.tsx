"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  claimOwnerKey,
  forgetOwnerKey,
  ownerLink,
} from "@/lib/owner-key-client";
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
 * length, and the timeline of past calls.
 */
export default function RoomPage({ room }: { room: RoomView }) {
  const router = useRouter();
  const [currentRoom, setCurrentRoom] = useState(room);
  const [starting, setStarting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ownerCopied, setOwnerCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [name, setName] = useState(room.name ?? "");
  const [defaultDuration, setDefaultDuration] = useState(
    room.defaultDurationSeconds
  );
  const [managementBusy, setManagementBusy] = useState(false);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  // Undefined while the fragment is still being claimed, so the management
  // controls do not flash in and out on first paint.
  const [ownerKey, setOwnerKey] = useState<string | null | undefined>(undefined);

  // Claims the key from `#k=…` if it is there, stores it, and strips it from
  // the address bar so copying the URL shares the room without handing over
  // control of it.
  //
  // This is the read-from-an-external-system case the rule exists to allow, and
  // it cannot be done anywhere else: the fragment is never sent to the server,
  // so there is nothing to read during render on the server, and claiming it
  // rewrites history, which is not something render may do.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwnerKey(claimOwnerKey(room.slug));
  }, [room.slug]);

  useEffect(() => {
    const capabilityCheck = setTimeout(
      () => setCanNativeShare(typeof navigator.share === "function"),
      0
    );
    return () => clearTimeout(capabilityCheck);
  }, []);

  useEffect(() => {
    if (ownerKey === undefined) return;
    void fetch(`/api/r/${room.slug}/opened`, {
      method: "POST",
      headers: ownerKey ? { "x-qwickword-owner-key": ownerKey } : undefined,
      keepalive: true,
    }).catch(() => {});
  }, [ownerKey, room.slug]);

  // A room is a rendezvous, so someone who opened it first needs to see a call
  // that the other person starts later. Poll only while the page is visible,
  // refresh immediately when it becomes visible again, and keep failures
  // silent: the existing room state is still usable, and pressing Start safely
  // reuses any active call on the server.
  useEffect(() => {
    let cancelled = false;
    let fetching = false;

    async function refreshRoom() {
      if (document.visibilityState === "hidden" || fetching) return;
      fetching = true;
      try {
        const response = await fetch(`/api/r/${room.slug}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as RoomView;
        if (!cancelled && payload.slug === room.slug) setCurrentRoom(payload);
      } catch {
        // A transient poll failure must not replace a usable room with an error.
      } finally {
        fetching = false;
      }
    }

    const intervalId = window.setInterval(() => void refreshRoom(), 5_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshRoom();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [room.slug]);

  const shareUrl = `https://qwickword.com/r/${room.slug}`;
  const title = currentRoom.name ?? room.slug.replace(/-/g, " ");
  const activeCall = currentRoom.calls.find((call) => call.active) ?? null;
  const others = DURATION_PRESETS_SECONDS.filter(
    (seconds) => seconds !== currentRoom.defaultDurationSeconds
  );

  const recordShare = useCallback(
    (via: "native" | "copy" | "email") => {
      void fetch(`/api/r/${room.slug}/shared`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ via }),
        keepalive: true,
      }).catch(() => {});
    },
    [room.slug]
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
      recordShare("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* a clipboard the browser refuses is not worth an error message */
    }
  }, [recordShare, shareUrl]);

  const nativeShare = useCallback(async () => {
    try {
      await navigator.share({
        title: `${title} · Qwickword room`,
        text: `Open this room for ${formatDuration(currentRoom.defaultDurationSeconds)} calls that end when the timer does.`,
        url: shareUrl,
      });
      recordShare("native");
    } catch {
      // Cancelling the share sheet is not a share and not an error.
    }
  }, [currentRoom.defaultDurationSeconds, recordShare, shareUrl, title]);

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

  const saveSettings = useCallback(async () => {
    if (!ownerKey || managementBusy) return;
    setManagementBusy(true);
    setManagementError(null);
    try {
      const response = await fetch(`/api/r/${room.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-qwickword-owner-key": ownerKey,
        },
        body: JSON.stringify({
          name: name.trim() || null,
          defaultDurationSeconds: defaultDuration,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setManagementError(payload?.error ?? "Couldn't update the room.");
        return;
      }
      setCurrentRoom(payload as RoomView);
      setName(payload.name ?? "");
      setDefaultDuration(payload.defaultDurationSeconds);
      router.refresh();
    } catch {
      setManagementError("No connection. Check your network and try again.");
    } finally {
      setManagementBusy(false);
    }
  }, [defaultDuration, managementBusy, name, ownerKey, room.slug, router]);

  const closeCurrentRoom = useCallback(async () => {
    if (!ownerKey || managementBusy) return;
    if (!window.confirm("Close this room? Its stable link will stop working.")) {
      return;
    }
    setManagementBusy(true);
    setManagementError(null);
    try {
      const response = await fetch(`/api/r/${room.slug}`, {
        method: "DELETE",
        headers: { "x-qwickword-owner-key": ownerKey },
      });
      const payload = await response.json();
      if (!response.ok) {
        setManagementError(payload?.error ?? "Couldn't close the room.");
        return;
      }
      forgetOwnerKey(room.slug);
      setClosed(true);
    } catch {
      setManagementError("No connection. Check your network and try again.");
    } finally {
      setManagementBusy(false);
    }
  }, [managementBusy, ownerKey, room.slug]);

  if (closed) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-white">
            Room closed
          </h1>
          <p className="text-zinc-600 dark:text-zinc-300">
            The stable link no longer opens this room. Its past calls remain in
            Qwickword&apos;s operational history.
          </p>
          <Link href="/" className="font-medium text-teal-700 underline underline-offset-4 dark:text-[#3DFEF1]">
            Back to Qwickword
          </Link>
        </div>
      </div>
    );
  }

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
            {formatDuration(currentRoom.defaultDurationSeconds)} by default
          </p>
        </header>

        <section
          aria-live="polite"
          aria-atomic="true"
          className="flex flex-col items-center gap-3"
        >
          {activeCall ? (
            <>
              <Link
                href={`/${activeCall.callName}`}
                className="w-full rounded-full bg-[#3DFEF1] px-6 py-4 text-center text-base font-semibold text-[#062B28] transition hover:opacity-90"
              >
                Join the current call
              </Link>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Someone already opened a{" "}
                {formatDuration(activeCall.durationSeconds)} call here.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void startCall(currentRoom.defaultDurationSeconds)}
              disabled={starting !== null}
              className="w-full rounded-full bg-[#3DFEF1] px-6 py-4 text-base font-semibold text-[#062B28] transition hover:opacity-90 disabled:opacity-50"
            >
              {starting === currentRoom.defaultDurationSeconds
                ? "Starting…"
                : "Start a call"}
            </button>
          )}

          {!activeCall && (
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
          )}

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
          <div className="mt-2 flex flex-wrap gap-1">
            {canNativeShare && (
              <button
                type="button"
                onClick={() => void nativeShare()}
                className="min-h-11 rounded-full px-3 text-sm font-medium text-[#0E9E93] dark:text-[#3DFEF1]"
              >
                Share
              </button>
            )}
            <button
              type="button"
              onClick={() => void copyLink()}
              className="min-h-11 rounded-full px-3 text-sm font-medium text-[#0E9E93] dark:text-[#3DFEF1]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={`mailto:?subject=${encodeURIComponent(`${title} · Qwickword room`)}&body=${encodeURIComponent(`Open this room for ${formatDuration(currentRoom.defaultDurationSeconds)} calls that end when the timer does. ${shareUrl}`)}`}
              onClick={() => recordShare("email")}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-[#0E9E93] dark:text-[#3DFEF1]"
            >
              Email it
            </a>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            This stable link opens the room until it is closed or expires after
            90 idle days. Opening it doesn&apos;t ring anyone.
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
              Private. Anyone with it can rename, re-length or close this room.
              Keep it somewhere safe. It can&apos;t be recovered.
            </p>
            <button
              type="button"
              onClick={() => void copyOwnerLink()}
              className="mt-2 min-h-11 rounded-full px-3 text-sm font-medium text-[#0E9E93] dark:text-[#3DFEF1]"
            >
              {ownerCopied ? "Copied" : "Copy owner link"}
            </button>

            <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Room settings
              </h2>
              <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">
                Room name
                <input
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus-visible:ring-[#3DFEF1] dark:focus-visible:ring-offset-zinc-950"
                />
              </label>
              <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">
                Default length
                <select
                  value={defaultDuration}
                  onChange={(event) =>
                    setDefaultDuration(Number(event.target.value))
                  }
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus-visible:ring-[#3DFEF1] dark:focus-visible:ring-offset-zinc-950"
                >
                  {DURATION_PRESETS_SECONDS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {formatDuration(seconds)}
                    </option>
                  ))}
                </select>
              </label>
              {managementError && (
                <p role="alert" className="mt-3 text-sm text-red-500">
                  {managementError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={managementBusy}
                  className="min-h-11 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {managementBusy ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => void closeCurrentRoom()}
                  disabled={managementBusy}
                  className="min-h-11 rounded-full px-4 text-sm font-medium text-red-600 disabled:opacity-50 dark:text-red-400"
                >
                  Close room
                </button>
              </div>
            </div>
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

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs tracking-widest text-zinc-400 uppercase">
              Calls
            </span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {currentRoom.calls.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No calls yet. Starting one will add it here.
            </p>
          ) : (
            <ul className="flex flex-col">
              {currentRoom.calls.map((call) => {
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
