// The call area: a Daily iframe (live mode) or a placeholder box (mock mode),
// plus the "open in new tab" fallback link. Pulled out as its own component
// (Phase 0 item 6, "Hard-end experience") because it now needs to be rendered
// from two places that must stay in sync: the call page's normal timed path
// (CallRoom, which unmounts this entirely once the countdown hits zero — see
// call-room.tsx for why that matters) and the "missing/invalid exp" fallback
// in page.tsx, which has no known expiry to drive a hard-end swap yet
// (that fallback becomes a real friendly screen in the next roadmap item,
// "Invalid/expired-link handling").
//
// No "use client" here: this component uses no hooks or browser-only APIs, so
// it can be imported directly from both a Server Component (page.tsx) and a
// Client Component (call-room.tsx) without needing the directive itself.
//
// Phase 1 item 1 ("Pre-join screen"): the live-mode iframe below now points at
// a room created with `enable_prejoin_ui: true` (src/lib/daily-rooms.ts), so
// Daily Prebuilt itself shows a lobby — name entry, camera/mic check — before
// the participant actually joins. No new component was needed for live mode;
// this file's only change is a short explanatory note in the mock-mode box
// below, since there is no real Daily embed to show a lobby inside.

export default function CallMedia({
  room,
  mockMode,
  joinUrl,
}: {
  room: string;
  mockMode: boolean;
  joinUrl: string | null;
}) {
  return (
    <>
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-black/[.08] bg-black dark:border-white/[.145]"
        style={{ aspectRatio: "16 / 9" }}
      >
        {mockMode ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-300">
            <p className="text-base font-medium">
              Mock call — no Daily API key configured
            </p>
            <p className="text-sm text-zinc-400">Room: {room}</p>
            <p className="max-w-xs text-xs text-zinc-500">
              In live mode, this box is a real call and opens on Daily&apos;s
              own pre-join lobby first — enter your name, check your camera
              and mic, then join.
            </p>
          </div>
        ) : (
          <iframe
            src={joinUrl ?? undefined}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-full w-full border-0"
            title="Qwickword call"
          />
        )}
      </div>

      {!mockMode && joinUrl && (
        <a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Having trouble? Open the call in a new tab
        </a>
      )}
    </>
  );
}
