export const OWNED_CONTENT_IDS = [
  "about_v1",
  "how_qwickword_works",
  "manifesto_v1",
  "persistent_rooms_guide_v1",
] as const;

export type OwnedContentId = (typeof OWNED_CONTENT_IDS)[number];

const OWNED_CONTENT_ID_SET = new Set<string>(OWNED_CONTENT_IDS);

export function isOwnedContentId(value: unknown): value is OwnedContentId {
  return typeof value === "string" && OWNED_CONTENT_ID_SET.has(value);
}
