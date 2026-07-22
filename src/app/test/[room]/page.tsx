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
// wrapper) — the whole point of the rebuild is video filling the viewport.
//
// No visible "v2"/"preview"/"test" labeling anywhere on this page (2026-07-22,
// Andreas, interactive: "it refers back to itself as a test which defeats
// the purpose of the test It's supposed to look like the final product so I
// can compare"). The only earlier concession to this being a parallel route
// was a small "v2 preview" badge in the corner — removed. Error-screen
// copy below matches production's own wording (src/app/[room]/page.tsx,
// src/components/call-room.tsx) as closely as this route's slightly
// different failure modes allow, rather than saying "preview" anywhere.

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
        Create a new one
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
        heading="This link isn't valid"
        message="It's missing information Qwickword needs to connect you — the link may have been copied incorrectly or cut off."
      />
    );
  }

  const { mockMode, domain } = getDailyConfig();

  if (mockMode) {
    return (
      <ErrorScreen
        heading="This Qwickword can't connect right now"
        message="No live video connection is configured in this environment."
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
          heading="This Qwickword doesn't exist"
          message="The room can't be found on our video provider — it may have been mistyped, or it's already gone."
        />
      );
    }
    console.error("[Qwickword v2] Failed to fetch live room status, falling back to waiting state:", err);
  }

  const initialRemainingMs = remainingMsUntil(exp);
  if (initialRemainingMs <= 0) {
    return (
      <ErrorScreen
        heading="This Qwickword has ended."
        message="It can't be rejoined or extended — that's the whole point."
      />
    );
  }

  const joinUrl = `https://${domain}/${room}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
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
