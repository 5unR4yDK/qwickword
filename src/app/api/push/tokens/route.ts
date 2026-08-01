import { NextRequest, NextResponse } from "next/server";
import {
  registerPushToken,
  revokePushTokensForSession,
} from "@/lib/push";
import { isExpoPushToken, isPushPlatform } from "@/lib/push-core";
import {
  callerFrom,
  sessionTokenFrom,
  signInRequired,
} from "@/lib/require-user";

export const dynamic = "force-dynamic";

type RegisterBody = {
  token?: unknown;
  platform?: unknown;
  deviceLabel?: unknown;
};

export async function POST(request: NextRequest) {
  const user = await callerFrom(request);
  const sessionToken = sessionTokenFrom(request);
  if (!user || !sessionToken) return signInRequired();

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  if (!isExpoPushToken(body.token) || !isPushPlatform(body.platform)) {
    return NextResponse.json(
      { error: "A valid push token and platform are required." },
      { status: 400 }
    );
  }
  const deviceLabel =
    typeof body.deviceLabel === "string"
      ? body.deviceLabel.trim().slice(0, 100) || null
      : null;
  const registered = await registerPushToken({
    userId: user.id,
    sessionToken,
    token: body.token,
    platform: body.platform,
    deviceLabel,
  });
  if (!registered) {
    return NextResponse.json(
      { error: "Push registration is temporarily unavailable." },
      { status: 503 }
    );
  }
  return NextResponse.json({ registered: true }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const user = await callerFrom(request);
  const sessionToken = sessionTokenFrom(request);
  if (!user || !sessionToken) return signInRequired();
  await revokePushTokensForSession(user.id, sessionToken);
  return NextResponse.json({ revoked: true }, { status: 200 });
}
