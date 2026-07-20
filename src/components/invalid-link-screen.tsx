import Link from "next/link";

// Friendly replacement for a crash or a half-working page when a link is
// dead or malformed (Phase 0 item 7, "Invalid/expired-link handling"). Two
// callers in src/app/[room]/page.tsx use this with different copy: a
// syntactically broken link (bad room name or missing/garbled `exp`, caught
// without ever calling Daily) and a syntactically fine link whose room no
// longer exists on Daily (caught by checkDailyRoomExists in
// src/lib/daily-rooms.ts, live mode only). Visually matches CallRoom's
// "ended" card (src/components/call-room.tsx) so a dead link looks the same
// however it died.
export default function InvalidLinkScreen({
  heading,
  message,
}: {
  heading: string;
  message: string;
}) {
  return (
    <div
      role="status"
      className="flex w-full max-w-3xl flex-col items-center gap-3 rounded-2xl border border-black/[.08] bg-white px-6 py-16 text-center dark:border-white/[.145] dark:bg-zinc-950"
    >
      <p className="text-lg font-medium text-black dark:text-zinc-50">{heading}</p>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        Create a new one
      </Link>
    </div>
  );
}
