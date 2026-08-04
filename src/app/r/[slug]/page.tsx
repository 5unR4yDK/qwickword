import type { Metadata } from "next";
import { isPlausibleRoomSlug, loadRoomView } from "@/lib/rooms";
import { formatDuration } from "@/lib/duration";
import {
  SOCIAL_PREVIEW_ALT,
  SOCIAL_PREVIEW_IMAGE,
  SOCIAL_PREVIEW_URL,
} from "@/lib/social-preview";
import RoomPage from "@/components/room-page";
import InvalidLinkScreen from "@/components/invalid-link-screen";

/**
 * A room: a place you come back to.
 *
 * Rooms live at `/r/{slug}`, a separate namespace from calls at `/{slug}`.
 * That separation is deliberate — every existing call link keeps working
 * unchanged, and no room slug can ever be mistaken for a call slug.
 *
 * Landing here does not start a call.
 */

type Props = { params: Promise<{ slug: string }> };

const PRIVATE_LINK_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
};

/**
 * Link previews name the room but never its contents. A room link is meant to
 * sit in an email signature, so the card has to be safe to show to anyone who
 * happens to see the message — a name and a length, nothing about who has been
 * in it or what was shared.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isPlausibleRoomSlug(slug)) {
    return { title: "Qwickword", robots: PRIVATE_LINK_ROBOTS };
  }

  const room = await loadRoomView(slug, 0);
  if (!room) {
    return { title: "Qwickword", robots: PRIVATE_LINK_ROBOTS };
  }

  const name = room.name ?? slug.replace(/-/g, " ");
  const title = `${name} · Qwickword room`;
  const description =
    `A room for ${formatDuration(room.defaultDurationSeconds)} calls. ` +
    "Opening it doesn't ring anyone; calls still end when the timer does.";

  return {
    title,
    description,
    robots: PRIVATE_LINK_ROBOTS,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Qwickword",
      url: `https://qwickword.com/r/${encodeURIComponent(slug)}`,
      images: [SOCIAL_PREVIEW_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: SOCIAL_PREVIEW_URL, alt: SOCIAL_PREVIEW_ALT }],
    },
  };
}

export default async function Room({ params }: Props) {
  const { slug } = await params;

  // The same full-bleed wrapper the call page uses, so a dead room link looks
  // like a dead call link rather than a broken page.
  const deadLink = (heading: string, message: string) => (
    <div className="fixed inset-0 h-dvh w-dvw overflow-hidden bg-black">
      <InvalidLinkScreen heading={heading} message={message} />
    </div>
  );

  if (!isPlausibleRoomSlug(slug)) {
    return deadLink(
      "This link isn't valid",
      "It doesn't look like a Qwickword room link. It may have been copied incorrectly or cut off."
    );
  }

  const room = await loadRoomView(slug);
  if (!room) {
    // Closed, expired after 90 idle days, or never real. One message for all
    // three: a visitor can act on none of them differently, and telling them
    // apart would confirm whether a given slug ever existed.
    return deadLink(
      "This room is closed",
      "It was retired, or it went unused for long enough to expire. Ask for a fresh link, or create a Qwickword of your own."
    );
  }

  return <RoomPage room={room} />;
}
