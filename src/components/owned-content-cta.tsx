"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  children: ReactNode;
  className: string;
  contentId: "how_qwickword_works";
  href: "/";
};

/**
 * A first-party content CTA that keeps external campaign attribution intact.
 *
 * The content ID is a fixed allowlisted value, not a URL or referrer string.
 * A normal primary click briefly waits for the same-origin event response so
 * its HttpOnly session/attribution cookies exist before the homepage records a
 * landing. Modified clicks keep normal Link behavior and are not intercepted.
 */
export default function OwnedContentCta({
  children,
  className,
  contentId,
  href,
}: Props) {
  const router = useRouter();
  const reporting = useRef(false);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      reporting.current
    ) {
      return;
    }

    event.preventDefault();
    reporting.current = true;
    const params = new URLSearchParams(window.location.search);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1_000);
    try {
      await fetch("/api/attribution/content-cta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          attribution: {
            source: params.get("utm_source"),
            medium: params.get("utm_medium"),
            campaign: params.get("utm_campaign"),
            content: params.get("utm_content"),
          },
        }),
        keepalive: true,
        signal: controller.signal,
      });
    } catch {
      // Measurement must never stop the person from reaching the product.
    } finally {
      window.clearTimeout(timeout);
      router.push(href);
    }
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
