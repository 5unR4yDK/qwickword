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

const CONTENT_IDS = new Set(["how_qwickword_works"]);

type Body = {
  contentId?: unknown;
  attribution?: unknown;
};

function hasCampaignAttribution(
  attribution: ReturnType<typeof normalizeAttribution>
): boolean {
  return Object.values(attribution).some((value) => value !== null);
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.contentId !== "string" || !CONTENT_IDS.has(body.contentId)) {
    return NextResponse.json({ error: "Unknown content CTA." }, { status: 400 });
  }

  const incomingAttribution = normalizeAttribution(body.attribution);
  const existingAttribution = attributionFromRequest(request);
  const attribution = hasCampaignAttribution(incomingAttribution)
    ? incomingAttribution
    : hasCampaignAttribution(existingAttribution)
      ? existingAttribution
      : incomingAttribution;
  const trafficClass =
    trustedTrafficClassFromRequest(request) ?? trafficClassFromRequest(request);
  const { sessionId } = sessionFromRequest(request);

  await appendEvent({
    kind: "content.cta_clicked",
    payload: {
      sessionId,
      trafficClass,
      surface: "web",
      contentId: body.contentId,
      destination: "create",
      ...attribution,
    },
    dedupeKey: `content.cta_clicked:${sessionId}:${body.contentId}:create`,
  });

  const response = NextResponse.json({ accepted: true }, { status: 200 });
  setSessionCookie(response, sessionId);
  setAttributionCookies(response, attribution, trafficClass);
  return response;
}
