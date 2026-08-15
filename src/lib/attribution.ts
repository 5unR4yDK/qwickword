import type { NextRequest, NextResponse } from "next/server";
import {
  decodeProbeTrafficToken,
  decodeTrafficCookie,
  encodeTrafficCookie,
  trafficClassFromUserAgent,
  type TrafficClass,
} from "@/lib/traffic-classification";

export const SESSION_COOKIE = "qw_session";
export const ATTRIBUTION_COOKIE = "qw_attribution";
export const TRAFFIC_COOKIE = "qw_traffic";
export const CREATED_ROOM_COOKIE = "qw_created_room";
export const PARENT_ROOM_COOKIE = "qw_parent_room";

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SAFE_VALUE = /^[a-z0-9_]+$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CampaignAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
};

export type AttributionContext = CampaignAttribution & {
  sessionId: string;
  trafficClass: TrafficClass;
  parentCallName?: string | null;
};

function safeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 &&
    normalized.length <= 80 &&
    SAFE_VALUE.test(normalized)
    ? normalized
    : null;
}

export function normalizeAttribution(raw: unknown): CampaignAttribution {
  const value =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    source: safeValue(value.source),
    medium: safeValue(value.medium),
    campaign: safeValue(value.campaign),
    content: safeValue(value.content),
  };
}

function trafficSecret(): string | null {
  return process.env.IDENTITY_HMAC_SECRET?.trim() || null;
}

export function sessionFromRequest(request: NextRequest): {
  sessionId: string;
  isNew: boolean;
} {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing && UUID.test(existing)) {
    return { sessionId: existing, isNew: false };
  }
  return { sessionId: crypto.randomUUID(), isNew: true };
}

export function attributionFromRequest(
  request: NextRequest
): CampaignAttribution {
  const encoded = request.cookies.get(ATTRIBUTION_COOKIE)?.value;
  if (!encoded) return normalizeAttribution(null);
  try {
    return normalizeAttribution(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    );
  } catch {
    return normalizeAttribution(null);
  }
}

export function trafficClassFromRequest(request: NextRequest): TrafficClass {
  const cookieClass = decodeTrafficCookie(
    request.cookies.get(TRAFFIC_COOKIE)?.value,
    trafficSecret()
  );
  return cookieClass === "public"
    ? trafficClassFromUserAgent(request.headers.get("user-agent"))
    : cookieClass;
}

export function trustedTrafficClassFromRequest(
  request: NextRequest
): TrafficClass | null {
  return decodeProbeTrafficToken(
    request.headers.get("x-qwickword-traffic-token"),
    trafficSecret()
  );
}

export function setSessionCookie(
  response: NextResponse,
  sessionId: string
): void {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function setAttributionCookies(
  response: NextResponse,
  attribution: CampaignAttribution,
  trafficClass: TrafficClass
): void {
  response.cookies.set(
    ATTRIBUTION_COOKIE,
    Buffer.from(JSON.stringify(attribution), "utf8").toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    }
  );
  response.cookies.set(
    TRAFFIC_COOKIE,
    encodeTrafficCookie(trafficClass, trafficSecret()),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    }
  );
}

export function setRoomCookie(
  response: NextResponse,
  name: typeof CREATED_ROOM_COOKIE | typeof PARENT_ROOM_COOKIE,
  room: string
): void {
  response.cookies.set(name, room, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearParentRoomCookie(response: NextResponse): void {
  response.cookies.set(PARENT_ROOM_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
