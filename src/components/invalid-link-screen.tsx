import Link from "next/link";

// Friendly replacement for a crash or a half-working page when a link is
// dead or malformed. src/app/[room]/page.tsx uses this with different copy
// per failure: a syntactically broken link (caught without ever calling
// Daily), a room Daily doesn't know (mistyped or already gone), and a
// transient failure loading a clean link's details.
//
// Full-bleed black, matching CallRoom's own "ended"/"left" screens
// (src/components/call-room.tsx) so a dead link looks the same however it
// died.
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
