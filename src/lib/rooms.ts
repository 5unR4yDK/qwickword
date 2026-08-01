// Server-only room loading. Reaches the database, so nothing a Client
// Component imports may come from here — the wire types, the validators and
// `callOutcome` all live in room-view.ts for that reason.
import { getRoom, getRoomCalls, type Room } from "./db";
import type { RoomCall, RoomView } from "./room-view";

export type { RoomCall, RoomView } from "./room-view";
export {
  callOutcome,
  isPlausibleRoomSlug,
  isValidDefaultDuration,
  normalizeRoomName,
} from "./room-view";

export function toRoomView(room: Room, calls: RoomCall[]): RoomView {
  return {
    slug: room.slug,
    name: room.name,
    defaultDurationSeconds: room.defaultDurationSeconds,
    createdAt: room.createdAt,
    lastUsedAt: room.lastUsedAt,
    calls,
  };
}

/**
 * Loads a room and its timeline together, since no caller wants one without
 * the other. Returns null for a room that does not exist, is closed, or has
 * gone idle past `ROOM_IDLE_DAYS` — `getRoom` applies all three.
 */
export async function loadRoomView(
  slug: string,
  limit = 20
): Promise<RoomView | null> {
  const room = await getRoom(slug);
  if (!room) return null;
  // `limit: 0` is used by link previews, which need the room's name but have
  // no business fetching its history.
  const calls = limit > 0 ? await getRoomCalls(room.id, limit) : [];
  return toRoomView(
    room,
    calls.map((call) => ({
      callName: call.roomName,
      durationSeconds: call.durationSeconds,
      createdAt: call.createdAt,
      startedAt: call.startedAt,
      endReason: call.endReason,
    }))
  );
}
