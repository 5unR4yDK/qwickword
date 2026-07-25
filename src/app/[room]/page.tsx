import type { Metadata } from "next";
import { getDailyConfig } from "@/lib/daily-config";
import { remainingMsUntil } from "@/lib/time";
import {
  DailyRoomError,
  getRoomStatus,
  isPlausibleRoomName,
} from "@/lib/daily-rooms";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "@/lib/duration";
import { getRecordedDurationSeconds } from "@/lib/db";
import CallRoom from "@/components/call-room";
import InvalidLinkScreen from "@/components/invalid-link-screen";

/**
 * Call page: joins the Daily room named by the `[room]` segment.
 *
 * A shared link is normally clean — just qwickword.com/<slug> — and this
 * page resolves everything else server-side: the room's live `exp` from
 * Daily (`getRoomStatus`), and the intended call length from the database
 * row written at creation (`getRecordedDurationSeconds`). Query params are
 * the fallback layer, not the primary path: a link that carries `exp`/`d`
 * (older links, mock-mode links, or a creation where the database write
 * failed) works with no lookup at all, exactly as before, and params take
 * precedence when present.
 *
 * The "hard-end experience" lives mostly in CallRoom
 * (src/components/call-room.tsx): once `exp` has passed, CallRoom shows a
 * plain "ended" screen with no rejoin/extend control anywhere, in place of
 * the call area.
 *
 * Invalid-link handling is this page's own job: a garbage room name is
 * rejected on syntax alone (no network call), and a room Daily doesn't know
 * (mistyped slug, or already expired and cleaned up) gets its own screen
 * from the 404 on the live status fetch.
 *
 * The countdown is anchored to first join, not link creation: a fresh
 * room's `exp` is a generous pre-start buffer, not the real call length
 * (see src/lib/daily-rooms.ts). Fetching the live `exp` is also the only
 * way two tabs opening the same link at very different times agree on the
 * same real countdown once it's started. CallRoom is what actually starts
 * it (a manual "Start now" button, or a second participant joining) and
 * owns the waiting-vs-counting-down UI.
 *
 * Backward compatible with links minted before durations existed at all
 * (no `d`, no database row): those links' `exp` was already the real,
 * ticking countdown at creation, and the live status fetch reads exactly
 * that state back (`started: true`), so they keep behaving as they always
 * did.
 *
 * Full-bleed black wrapper, no header/footer chrome — the call UI fills the
 * viewport rather than sitting inside a light "Qwickword" header + call card
 * + footer layout, since video filling the frame reads better than a Daily
 * Prebuilt iframe sized to fit inside a card. `fixed inset-0 h-dvh w-dvw`
 * (rather than `h-screen`/`w-screen`) is a mobile-viewport fix: `h-dvh`
 * tracks the CURRENT visible height as the browser chrome shows/hides, so
 * there's never a way to scroll the countdown or controls out of view.
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
 * Link-preview metadata: a per-link title/description carrying the call's
 * real length, so a shared link previews as "Someone wants to have a
 * Qwickword (7 min)" in WhatsApp/iMessage/Slack. Deliberately generic
 * ("Someone"), not a real name — there's no "your name" field in the create
 * flow, so a shared card never leaks a participant or a topic, only the
 * length and the promise that it ends.
 *
 * The duration comes from the link's `d` query param when present, or the
 * database row written at creation for a clean param-less link. A link with
 * neither (a pre-duration-era link, or a database miss) falls back to a
 * generic title/description. The OG images and metadataBase are inherited
 * from the root layout.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { room } = await params;
  const { d: rawDuration } = await searchParams;
  const durationSeconds =
    parseDurationParam(rawDuration) ??
    (isPlausibleRoomName(room) ? await getRecordedDurationSeconds(room) : null);

  if (!durationSeconds) {
    const description =
      "Set a time limit, share the link. When the timer hits zero, the call ends.";
    return {
      title: "Qwickword",
      description,
      openGraph: { title: "Qwickword", description, type: "website", siteName: "Qwickword" },
      twitter: { card: "summary_large_image", title: "Qwickword", description },
    };
  }

  const minutes = Math.round(durationSeconds / 60);
  const title = `Someone wants to have a Qwickword (${minutes} min)`;
  const description =
    `${minutes} minutes, hard stop — it ends when the timer does and ` +
    "can't be extended.";

  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Qwickword" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { room } = await params;
  const { exp: rawExp, d: rawDuration } = await searchParams;
  const expParam = Array.isArray(rawExp) ? rawExp[0] : rawExp;
  const linkExp = expParam ? Number(expParam) : NaN;
  const hasValidLinkExp = Number.isFinite(linkExp) && linkExp > 0;

  if (!isPlausibleRoomName(room)) {
    return (
      <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
        <InvalidLinkScreen
          heading="This link isn't valid"
          message="It doesn't look like a Qwickword link — it may have been copied incorrectly or cut off."
        />
      </div>
    );
  }

  const { mockMode, domain } = getDailyConfig();

  if (mockMode) {
    // Mock rooms are never persisted anywhere, so a mock link must carry its
    // own `exp`/`d` — there is nothing to look up. Mock links always do
    // (POST /api/rooms marks them `clean: false`).
    if (!hasValidLinkExp) {
      return (
        <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
          <InvalidLinkScreen
            heading="This link isn't valid"
            message="It's missing information Qwickword needs to connect you — the link may have been copied incorrectly or cut off."
          />
        </div>
      );
    }
    const mockDuration = parseDurationParam(rawDuration);
    return (
      <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
        <CallRoom
          room={room}
          exp={linkExp}
          durationSeconds={mockDuration}
          // A mock link with a duration waits for the client-side start
          // trigger; one without is a legacy-style already-ticking link.
          initialStarted={mockDuration === null}
          initialRemainingMs={remainingMsUntil(linkExp)}
          mockMode={mockMode}
          joinUrl={null}
        />
      </div>
    );
  }

  // Live mode. The duration: query param first (older/fallback links), then
  // the database row written at creation (the normal, clean-link path).
  let durationSeconds = parseDurationParam(rawDuration);
  if (durationSeconds === null) {
    durationSeconds = await getRecordedDurationSeconds(room);
  }

  // The room's live state, straight from Daily — also the existence check.
  let exp: number;
  let started: boolean;
  try {
    const status = await getRoomStatus(room, hasValidLinkExp ? linkExp : 0);
    exp = status.exp;
    started = status.started;
  } catch (err) {
    if (err instanceof DailyRoomError && err.status === 404) {
      // A room Daily doesn't know but the database does was real once —
      // it's over (expired, ended, or abandoned before it started), not
      // mistyped. Only a name with no record anywhere gets the
      // "doesn't exist" framing.
      const wasReal = durationSeconds !== null;
      return (
        <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
          <InvalidLinkScreen
            heading={
              wasReal ? "This Qwickword is over" : "This Qwickword doesn't exist"
            }
            message={
              wasReal
                ? "The call ended or the link expired — every Qwickword is single-use. Ask for a fresh link, or create one yourself."
                : "The room can't be found — the link may have been mistyped, or it's already gone."
            }
          />
        </div>
      );
    }
    // Transient failure (network blip, Daily hiccup). A link carrying its
    // own `exp` can still render the waiting state from that; a clean link
    // has nothing to render a countdown against, so ask for a reload rather
    // than guessing.
    console.error("[Qwickword] Failed to fetch live room status:", err);
    if (!hasValidLinkExp) {
      return (
        <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
          <InvalidLinkScreen
            heading="Couldn't load this Qwickword"
            message="Something went wrong fetching the call's details. Reload the page to try again."
          />
        </div>
      );
    }
    exp = linkExp;
    started = durationSeconds === null;
  }

  // A clean link whose database row is missing (it was written at creation,
  // so this means a later database problem) can't start a countdown — the
  // start call needs the intended length. If the room is already ticking
  // the duration is only cosmetic (progress rail), so let it through.
  if (durationSeconds === null && !started) {
    return (
      <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
        <InvalidLinkScreen
          heading="Couldn't load this Qwickword"
          message="Something went wrong fetching the call's details. Reload the page to try again."
        />
      </div>
    );
  }

  const initialRemainingMs = remainingMsUntil(exp);
  const joinUrl = `https://${domain}/${room}`;

  return (
    <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
      <CallRoom
        room={room}
        exp={exp}
        durationSeconds={durationSeconds}
        initialStarted={started}
        initialRemainingMs={initialRemainingMs}
        mockMode={mockMode}
        joinUrl={joinUrl}
      />
    </div>
  );
}
