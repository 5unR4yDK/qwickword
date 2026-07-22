import Link from "next/link";
import { getDailyConfig } from "@/lib/daily-config";
import { remainingMsUntil } from "@/lib/time";
import { DailyRoomError, getRoomStatus, isPlausibleRoomName } from "@/lib/daily-rooms";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "@/lib/duration";
import TestCallRoom from "@/components/call-v2/test-call-room";

// v2 call UI preview (CALL_UI_REBUILD_SPEC.md) — a parallel call page under
// /test, deliberately separate from the production /[room] route so nothing
// here can affect a real Qwickword call while the new design is being
// judged. Andreas, interactive: "Can we build this in parallel to the
// existing quick word just under a folder like '/test' Just to see what it
// looks like before we start overriding the current view."
//
// Reuses the SAME room-creation/start API routes as production (POST
// /api/rooms, POST /api/rooms/[room]/start) — a /test room is a real Daily
// room with the same hard-expiry enforcement, so this is a genuine preview
// of the call, not a mockup. It does mean /test rooms show up in the Neon
// stats table (src/lib/db.ts) alongside real calls — low volume, harmless
// test data, not worth the complexity of a skip-stats flag for a throwaway
// preview route. See STATUS.md.
//
// Deliberately no PageShell (src/app/[room]/page.tsx's header/footer
// wrapper) — the whole point of the rebuild is video filling the viewport,
// so this page is just a full-bleed black canvas plus a small "back to v2
// preview" link, not Qwickword's usual page chrome.

type Props = {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ exp?: string | string[]; d?: string | string[] }>;
};

function parseDurationParam(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const durationSeconds = value ? Number(value) : NaN;
  const isValid =
    Number.isFinite(durationSeconds) &&
    Number.isInteger(durationSeconds) &&
    durationSeconds >= MIN_DURATION_SECONDS &&
    durationSeconds <= MAX_DURATION_SECONDS;
  return isValid ? durationSeconds : null;
}

function ErrorScreen({ heading, message }: { heading: string; message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      <p className="text-lg font-medium">{heading}</p>
      <p className="max-w-sm text-sm text-zinc-400">{message}</p>
      <Link
        href="/test"
        className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-zinc-200"
      >
        Back to the v2 preview
      </Link>
    </div>
  );
}

export default async function TestRoomPage({ params, searchParams }: Props) {
  const { room } = await params;
  const { exp: rawExp, d: rawDuration } = await searchParams;
  const expParam = Array.isArray(rawExp) ? rawExp[0] : rawExp;
  const linkExp = expParam ? Number(expParam) : NaN;
  const hasValidLinkExp = Number.isFinite(linkExp) && linkExp > 0;
  const hasValidRoomName = isPlausibleRoomName(room);
  const durationSeconds = parseDurationParam(rawDuration);

  if (!hasValidRoomName || !hasValidLinkExp || durationSeconds === null) {
    return (
      <ErrorScreen
        heading="This preview link isn't valid"
        message="It's missing information this page needs — try creating a fresh one from the v2 preview home."
      />
    );
  }

  const { mockMode, domain } = getDailyConfig();

  if (mockMode) {
    return (
      <ErrorScreen
        heading="The v2 preview needs a live Daily connection"
        message="No DAILY_API_KEY/DAILY_DOMAIN configured in this environment — the call-object-mode rebuild has nothing real to connect to in mock mode."
      />
    );
  }

  let exp = linkExp;
  let started = false;
  try {
    const status = await getRoomStatus(room, linkExp);
    exp = status.exp;
    started = status.started;
  } catch (err) {
    if (err instanceof DailyRoomError && err.status === 404) {
      return (
        <ErrorScreen
          heading="This preview room doesn't exist"
          message="It may have expired, or the link was mistyped."
        />
      );
    }
    console.error("[Qwickword v2] Failed to fetch live room status, falling back to waiting state:", err);
  }

  const initialRemainingMs = remainingMsUntil(exp);
  if (initialRemainingMs <= 0) {
    return (
      <ErrorScreen
        heading="This preview Qwickword has ended"
        message="Create a fresh one from the v2 preview home to keep testing."
      />
    );
  }

  const joinUrl = `https://${domain}/${room}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Link
        href="/test"
        className="absolute top-4 left-4 z-10 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur hover:text-white"
      >
        v2 preview
      </Link>
      <TestCallRoom
        room={room}
        joinUrl={joinUrl}
        exp={exp}
        durationSeconds={durationSeconds}
        initialStarted={started}
      />
    </div>
  );
}
