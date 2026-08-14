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

export const dynamic = "force-dynamic";

type LandingBody = {
  attribution?: unknown;
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
      ...attribution,
    },
    dedupeKey: [
      "landing.view",
      sessionId,
      attribution.campaign ?? "none",
      attribution.source ?? "direct",
      attribution.content ?? "none",
    ].join(":"),
  });

  const response = NextResponse.json({ accepted: true }, { status: 200 });
  setSessionCookie(response, sessionId);
  setAttributionCookies(response, attribution, trafficClass);
  return response;
}
