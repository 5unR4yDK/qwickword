"use client";

import { useEffect } from "react";

/**
 * Records that a signed-in browser was in this call.
 *
 * Renders nothing. It exists so someone who joined from the web can afterwards
 * be kept as a contact by the other person, and can keep them — without it,
 * every browser participant is permanently a stranger and the contact graph
 * only ever grows between two app users.
 *
 * Silent and best-effort in every direction. A signed-out visitor gets a 401
 * and nothing happens, which is exactly right: joining a Qwickword needs no
 * account and must leave no trace for someone who has not chosen to have one.
 * A failure here can never affect the call.
 */
export default function RecordParticipation({ callName }: { callName: string }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/calls/${encodeURIComponent(callName)}/participants`, {
      method: "POST",
      signal: controller.signal,
    }).catch(() => {
      /* not signed in, offline, or navigated away. None of it matters here. */
    });
    return () => controller.abort();
  }, [callName]);

  return null;
}
