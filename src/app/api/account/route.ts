import { NextRequest, NextResponse } from "next/server";
import { deleteAccount } from "@/lib/identity";
import {
  clearSessionCookie,
  sessionTokenFrom,
  signInRequired,
} from "@/lib/require-user";

/** Permanently removes the signed-in account and every linked server record. */
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const result = await deleteAccount(sessionTokenFrom(request));
  if (result === "unauthorized") return signInRequired();
  if (result === "unavailable") {
    return NextResponse.json(
      { error: "Account deletion is temporarily unavailable. Try again." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ deleted: true }, { status: 200 });
  clearSessionCookie(response);
  return response;
}
