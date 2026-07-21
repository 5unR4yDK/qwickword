import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getDailyConfig } from "@/lib/daily-config";
import { remainingMsUntil } from "@/lib/time";
import {
  DailyRoomError,
  checkDailyRoomExists,
  getRoomStatus,
  isPlausibleRoomName,
} from "@/lib/daily-rooms";
import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  formatMinutesPhrase,
} from "@/lib/duration";
import CallRoom from "@/components/call-room";
import InvalidLinkScreen from "@/components/invalid-link-screen";

/**
 * Call page (Phase 0 item 5): joins the Daily room named by the `[room]`
 * segment and shows a countdown synced to the `exp` query param.
 *
 * Deliberately stateless (no database — see BUILD_PLAN.md / ROADMAP.md
 * Phase 1's "no database until a feature needs one" decision): the link
 * created by CreateLinkForm already carries `exp` (the room's Unix expiry
 * timestamp) as a query param, so this page needs no server-side lookup to
 * know the countdown target for a well-formed link. Both parties opening
 * the same link see the same `exp`, hence the same countdown.
 *
 * Phase 0 item 6 ("Hard-end experience") lives mostly in CallRoom
 * (src/components/call-room.tsx): once `exp` has passed, CallRoom shows a
 * plain "ended" screen with no rejoin/extend control anywhere, in place of
 * the call area.
 *
 * Phase 0 item 7 ("Invalid/expired-link handling") is this page's own job,
 * gating entry to CallRoom with two checks, cheapest first:
 *  1. Syntax: is `room` a plausible room name, and is `exp` a real number?
 *     No network call — this catches a mistyped/truncated/mangled link
 *     immediately. (A link whose `exp` has already passed but is otherwise
 *     well-formed is NOT caught here — that's a normal, working link that
 *     has simply ended; CallRoom already renders the right "ended" screen
 *     for it, reusing item 6's work rather than duplicating it here.)
 *  2. Existence (live mode only, and only when the link claims to still be
 *     within its window — see the `initialRemainingMs > 0` guard below):
 *     does this room still exist on Daily? Mock mode has nothing to check
 *     this against (mock rooms are never persisted anywhere — see
 *     checkDailyRoomExists's doc comment in src/lib/daily-rooms.ts), so a
 *     syntactically valid mock link is trusted as-is; its own `exp` is still
 *     enforced by CallRoom once it passes, same as any other link.
 * Skipping the existence check once the link already claims to be expired
 * avoids an unnecessary Daily API call for a case CallRoom already handles
 * correctly from the `exp` math alone, with no regression risk to item 6's
 * already-verified behaviour for that path.
 *
 * "Anchor the countdown to first join, not link creation" (built 2026-07-21,
 * interactive): a link now also carries `d` (the intended durationSeconds).
 * The `exp` in a freshly-created link is a generous pre-start buffer, not the
 * real call length (see src/lib/daily-rooms.ts) — this page's job is to
 * re-fetch the room's *live* `exp` from Daily (via `getRoomStatus`) rather
 * than trusting the link's own `exp`, since that's the only way two tabs
 * opening the same link at very different times agree on the same real
 * countdown once it's started. CallRoom (src/components/call-room.tsx) is
 * what actually starts it (a manual "Start now" button, or daily-js
 * detecting a second participant) and owns the waiting-vs-counting-down UI.
 *
 * Backward compatible with links minted before this feature (`d` missing):
 * those links' `exp` was already the real, already-ticking countdown at
 * creation time — this page treats a missing `d` as "already started," so an
 * older link keeps behaving exactly as it always did.
 */

type Props = {
  params: Promise<{ room: string }>;
  searchParams: Promise<{
    exp?: string | string[];
    d?: string | string[];
  }>;
};

/**
 * Parses and bounds-checks the `d` (durationSeconds) query param, shared by
 * both `generateMetadata` (below) and the page component — kept in one place
 * so the two can't quietly drift on what counts as a valid duration.
 */
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

/**
 * Link-preview metadata (added 2026-07-21, interactive): Andreas shared a
 * link in WhatsApp and got the root layout's generic title/description back
 * — "Qwickword" / "Set a time limit, share the link..." — and asked for
 * something more inviting, tied to the actual link: "Someone wants a
 * Qwickword. Click to start your X minute meeting." No name is included
 * (confirmed with Andreas rather than guessing) — adding a "your name" field
 * to the create flow was considered and explicitly deferred, so this stays
 * generic ("Someone") for every link, not just his own.
 *
 * Falls back to the root layout's original description for a link with no
 * valid `d` (a pre-this-feature link, or a mistyped one) — same content
 * either way, no announcement of the failure.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { d: rawDuration } = await searchParams;
  const durationSeconds = parseDurationParam(rawDuration);

  const description = durationSeconds
    ? `Someone wants a Qwickword. Click to start your ${formatMinutesPhrase(durationSeconds)} meeting.`
    : "Set a time limit, share the link. The call ends when it hits zero.";

  return {
    title: "Qwickword",
    description,
    openGraph: {
      title: "Qwickword",
      description,
    },
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Qwickword
      </h1>

      {children}

      <Link
        href="/"
        className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        Create your own Qwickword
      </Link>
    </div>
  );
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { room } = await params;
  const { exp: rawExp, d: rawDuration } = await searchParams;
  const expParam = Array.isArray(rawExp) ? rawExp[0] : rawExp;
  const linkExp = expParam ? Number(expParam) : NaN;
  const hasValidLinkExp = Number.isFinite(linkExp) && linkExp > 0;
  const hasValidRoomName = isPlausibleRoomName(room);

  const durationSeconds = parseDurationParam(rawDuration);
  const hasValidDuration = durationSeconds !== null;

  if (!hasValidRoomName || !hasValidLinkExp) {
    return (
      <PageShell>
        <InvalidLinkScreen
          heading="This link isn't valid"
          message="It's missing information Qwickword needs to connect you — the link may have been copied incorrectly or cut off."
        />
      </PageShell>
    );
  }

  const { mockMode, domain } = getDailyConfig();

  let exp = linkExp;
  // Legacy default: a link with no `d` was minted before this feature, so
  // its `exp` was already the real, already-ticking countdown — treat it as
  // started so old links keep behaving exactly as they always did.
  let started = true;

  if (hasValidDuration) {
    if (mockMode) {
      // Mock mode has no persisted room to poll — CallRoom's own client-side
      // "Start now"/join-detected trigger takes over from here.
      started = false;
    } else {
      try {
        const status = await getRoomStatus(room, linkExp);
        exp = status.exp;
        started = status.started;
      } catch (err) {
        if (err instanceof DailyRoomError && err.status === 404) {
          return (
            <PageShell>
              <InvalidLinkScreen
                heading="This Qwickword doesn't exist"
                message="The room can't be found on our video provider — it may have been mistyped, or it's already gone."
              />
            </PageShell>
          );
        }
        // Unexpected error (network blip, Daily hiccup) — fall back to the
        // waiting state with the link's own buffer `exp` rather than crashing
        // the page or guessing a countdown target. CallRoom's own status
        // polling gets another chance to fetch the real state once mounted.
        console.error(
          "[Qwickword] Failed to fetch live room status, falling back to waiting state:",
          err
        );
        started = false;
      }
    }
  } else {
    // Legacy link path (no `d`): keep the original existence-check behavior.
    const legacyRemainingMs = remainingMsUntil(exp);
    if (!mockMode && legacyRemainingMs > 0) {
      const exists = await checkDailyRoomExists(room);
      if (!exists) {
        return (
          <PageShell>
            <InvalidLinkScreen
              heading="This Qwickword doesn't exist"
              message="The room can't be found on our video provider — it may have been mistyped, or it's already gone."
            />
          </PageShell>
        );
      }
    }
  }

  const initialRemainingMs = remainingMsUntil(exp);
  const joinUrl = mockMode ? null : `https://${domain}/${room}`;

  return (
    <PageShell>
      <CallRoom
        room={room}
        exp={exp}
        durationSeconds={durationSeconds}
        initialStarted={started}
        initialRemainingMs={initialRemainingMs}
        mockMode={mockMode}
        joinUrl={joinUrl}
      />
    </PageShell>
  );
}
