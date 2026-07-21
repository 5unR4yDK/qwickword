import Link from "next/link";
import type { ReactNode } from "react";
import { getDailyConfig } from "@/lib/daily-config";
import { remainingMsUntil } from "@/lib/time";
import { checkDailyRoomExists, isPlausibleRoomName } from "@/lib/daily-rooms";
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
 */

type Props = {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ exp?: string | string[] }>;
};

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
  const { exp: rawExp } = await searchParams;
  const expParam = Array.isArray(rawExp) ? rawExp[0] : rawExp;
  const exp = expParam ? Number(expParam) : NaN;
  const hasValidExp = Number.isFinite(exp) && exp > 0;
  const hasValidRoomName = isPlausibleRoomName(room);

  if (!hasValidRoomName || !hasValidExp) {
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
  const initialRemainingMs = remainingMsUntil(exp);

  if (!mockMode && initialRemainingMs > 0) {
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

  const joinUrl = mockMode ? null : `https://${domain}/${room}`;

  return (
    <PageShell>
      <CallRoom
        room={room}
        exp={exp}
        initialRemainingMs={initialRemainingMs}
        mockMode={mockMode}
        joinUrl={joinUrl}
      />
    </PageShell>
  );
}
