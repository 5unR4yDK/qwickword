"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * App-wide error boundary (added 2026-07-21, interactive: Andreas reported
 * "Join the meeting now" occasionally showing a browser-level crash page —
 * "This page couldn't load. Reload to try again, or go back." — instead of
 * anything from this app). There was no error boundary anywhere in the app
 * before this, at any level — any uncaught exception during render (the
 * daily-js "duplicate instance" bug fixed the same day in
 * src/components/call-media.tsx was the immediate trigger, but this file
 * guards against any future one too) had nowhere to land except the
 * browser's own generic crash UI.
 *
 * Next.js requires this file to be a Client Component and to accept exactly
 * `error` and `reset` — `reset()` re-renders the segment that crashed
 * without a full page reload, which is the friendlier first thing to try
 * before sending someone back to a fresh link.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side errors are already logged where they're thrown; this is
    // the one place a *client-side* render error is guaranteed to be
    // observable at all right now (no error-tracking service wired up yet).
    console.error("[Qwickword] Caught a render error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-24 text-center dark:bg-black">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        That&apos;s a bug on our side, not anything you did. Your link itself
        is still fine — try again, or head back and open it fresh.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex items-center rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-black/[.2] dark:border-white/[.145] dark:text-zinc-300 dark:hover:border-white/[.3]"
        >
          Back to Qwickword
        </Link>
      </div>
    </div>
  );
}
