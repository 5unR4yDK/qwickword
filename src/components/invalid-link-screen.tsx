import Link from "next/link";

// Friendly replacement for a crash or a half-working page when a link is
// dead or malformed (Phase 0 item 7, "Invalid/expired-link handling"). Two
// callers in src/app/[room]/page.tsx use this with different copy: a
// syntactically broken link (bad room name or missing/garbled `exp`, caught
// without ever calling Daily) and a syntactically fine link whose room no
// longer exists on Daily (caught by checkDailyRoomExists in
// src/lib/daily-rooms.ts, live mode only).
//
// Restyled full-bleed black 2026-07-22 alongside the rest of the call page,
// when it dropped its old light-card PageShell wrapper for the call-object-
// mode UI's own full-viewport black design (see src/app/[room]/page.tsx) —
// matches CallRoom's own "ended"/"left" screens (src/components/call-room.tsx)
// so a dead link looks the same however it died, rather than looking like a
// leftover from the old light-themed page shell.
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
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white"
    >
      <p className="text-lg font-medium">{heading}</p>
      <p className="max-w-sm text-sm text-white/60">{message}</p>
      <Link
        href="/"
        className="mt-2 cursor-pointer rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
      >
        Create a new one
      </Link>
    </div>
  );
}
