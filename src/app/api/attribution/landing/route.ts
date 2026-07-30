import { NextRequest, NextResponse } from "next/server";
import {
  normalizeAttribution,
  normalizeTrafficClass,
  sessionFromRequest,
  setAttributionCookies,
  setSessionCookie,
} from "@/lib/attribution";
import { appendEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

type LandingBody = {
  attribution?: unknown;
  trafficClass?: unknown;
};

export async function POST(request: NextRequest) {
  let body: LandingBody = {};
  try {
    body = (await request.json()) as LandingBody;
  } catch {
    // A direct visit with no campaign fields is still a valid landing.
  }

  const attribution = normalizeAttribution(body.attribution);
  const trafficClass = normalizeTrafficClass(body.trafficClass);
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
