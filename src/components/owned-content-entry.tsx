"use client";

import { useEffect } from "react";
import type { OwnedContentId } from "@/lib/owned-content";
import { classifyReferrer } from "@/lib/referrer-category";

type Props = {
  contentId: OwnedContentId;
};

function clientAttribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
  };
}

function referrerCategory() {
  const navigation = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.name) {
    const documentPath = new URL(navigation.name).pathname;
    if (documentPath !== window.location.pathname) return "internal";
  }
  return classifyReferrer(document.referrer, window.location.origin);
}

/** Records an allowlisted owned-page entry without exposing a referrer URL. */
export default function OwnedContentEntry({ contentId }: Props) {
  useEffect(() => {
    void fetch("/api/attribution/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId,
        referrerCategory: referrerCategory(),
        attribution: clientAttribution(),
      }),
      keepalive: true,
    }).catch(() => {});
  }, [contentId]);

  return null;
}
