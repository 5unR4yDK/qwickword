import { NextRequest, NextResponse } from "next/server";
import {
  attributionFromRequest,
  normalizeAttribution,
  sessionFromRequest,
  setAttributionCookies,
  setSessionCookie,
  trafficClassFromRequest,
  trustedTrafficClassFromRequest,
} from "@/lib/attribution";
import { appendEvent } from "@/lib/db";
import { isOwnedContentId } from "@/lib/owned-content";
import { isReferrerCategory } from "@/lib/referrer-category";

export const dynamic = "force-dynamic";

type LandingBody = {
  attribution?: unknown;
  contentId?: unknown;
  referrerCategory?: unknown;
};

function hasCampaignAttribution(
  attribution: ReturnType<typeof normalizeAttribution>
): boolean {
  return Object.values(attribution).some((value) => value !== null);
}

export async function POST(request: NextRequest) {
  let body: LandingBody = {};
  try {
    body = (await request.json()) as LandingBody;
  } catch {
    // A direct visit with no campaign fields is still a valid landing.
  }

  if (body.contentId !== undefined && !isOwnedContentId(body.contentId)) {
    return NextResponse.json(
      { error: "Unknown owned content." },
      { status: 400 }
    );
  }
  if (
    body.referrerCategory !== undefined &&
    !isReferrerCategory(body.referrerCategory)
  ) {
    return NextResponse.json(
      { error: "Unknown referrer category." },
      { status: 400 }
    );
  }

  const incomingAttribution = normalizeAttribution(body.attribution);
  const existingAttribution = attributionFromRequest(request);
  // Keep the source that introduced a visitor when they return directly
  // before creating. A new tagged visit still replaces the prior source.
  const attribution = hasCampaignAttribution(incomingAttribution)
    ? incomingAttribution
    : hasCampaignAttribution(existingAttribution)
      ? existingAttribution
      : incomingAttribution;
  const trafficClass =
    trustedTrafficClassFromRequest(request) ??
    trafficClassFromRequest(request);
  const { sessionId } = sessionFromRequest(request);

  await appendEvent({
    kind: "landing.view",
    payload: {
      sessionId,
      trafficClass,
      surface: "web",
      contentId: body.contentId ?? null,
      referrerCategory: body.referrerCategory ?? null,
      ...attribution,
    },
    dedupeKey: [
      "landing.view",
      sessionId,
      attribution.campaign ?? "none",
      attribution.source ?? "direct",
      attribution.content ?? "none",
      body.contentId ?? "home",
      body.referrerCategory ?? "unknown",
    ].join(":"),
  });

  const response = NextResponse.json({ accepted: true }, { status: 200 });
  setSessionCookie(response, sessionId);
  setAttributionCookies(response, attribution, trafficClass);
  return response;
}
