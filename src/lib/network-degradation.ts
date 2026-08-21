import type {
  DailyCall,
  DailyReceiveSettings,
  DailyReceiveSettingsUpdates,
  DailySendSettings,
} from "@daily-co/daily-js";

export const BAD_NETWORK_GRACE_MS = 5_000;

export type NetworkQuality =
  | "unknown"
  | "good"
  | "warning"
  | "low"
  | "bad";

export type NetworkMediaMode = "standard" | "reduced" | "audio-only";

export type NetworkPolicyState = {
  quality: NetworkQuality;
  mode: NetworkMediaMode;
  badSince: number | null;
};

export type NetworkPolicyEvent =
  | { type: "QUALITY_CHANGED"; quality: NetworkQuality; at: number }
  | { type: "BAD_GRACE_EXPIRED"; at: number }
  | { type: "RESTORE_VIDEO"; at: number };

export const INITIAL_NETWORK_POLICY: NetworkPolicyState = {
  quality: "unknown",
  mode: "standard",
  badSince: null,
};

export function normalizeNetworkQuality(value: unknown): NetworkQuality {
  return value === "good" ||
    value === "warning" ||
    value === "low" ||
    value === "bad"
    ? value
    : "unknown";
}

/**
 * Converts Daily's network assessment into a small, explicit media policy.
 *
 * `low` is accepted alongside the installed SDK's `warning` because Daily's
 * current public reference calls the middle state `low`. Supporting both
 * keeps a server-side naming change from disabling degradation.
 *
 * Audio-only is deliberately sticky. A recovered connection updates the
 * quality indicator, but camera/video subscriptions return only after the
 * user chooses to try video again; Qwickword never surprises someone by
 * silently switching their camera back on.
 */
export function reduceNetworkPolicy(
  state: NetworkPolicyState,
  event: NetworkPolicyEvent
): NetworkPolicyState {
  switch (event.type) {
    case "QUALITY_CHANGED": {
      if (event.quality === "bad") {
        return {
          quality: "bad",
          mode: state.mode === "audio-only" ? "audio-only" : "reduced",
          badSince:
            state.mode === "audio-only"
              ? null
              : state.quality === "bad" && state.badSince !== null
                ? state.badSince
                : event.at,
        };
      }

      if (state.mode === "audio-only") {
        return { ...state, quality: event.quality, badSince: null };
      }

      if (event.quality === "warning" || event.quality === "low") {
        return { quality: event.quality, mode: "reduced", badSince: null };
      }

      if (event.quality === "good") {
        return { quality: "good", mode: "standard", badSince: null };
      }

      // An unknown assessment is not evidence that a constrained connection
      // recovered. Keep the current non-terminal media mode.
      return { ...state, quality: "unknown", badSince: null };
    }

    case "BAD_GRACE_EXPIRED":
      return state.quality === "bad" &&
        state.mode !== "audio-only" &&
        state.badSince !== null &&
        event.at - state.badSince >= BAD_NETWORK_GRACE_MS
        ? { ...state, mode: "audio-only", badSince: null }
        : state;

    case "RESTORE_VIDEO":
      return {
        quality: state.quality,
        mode:
          state.quality === "good" || state.quality === "unknown"
            ? "standard"
            : "reduced",
        // If Daily still says `bad`, give the attempted video another full
        // grace window before protecting audio again.
        badSince: state.quality === "bad" ? event.at : null,
      };

    default:
      return state;
  }
}

type MediaProfile = {
  sendSettings: DailySendSettings;
  receiveSettings: DailyReceiveSettingsUpdates;
  subscribeToVideo: boolean;
};

export const INITIAL_NETWORK_RECEIVE_SETTINGS: DailyReceiveSettings = {
  base: { video: { layer: 2 }, screenVideo: { layer: 0 } },
  "*": { video: { layer: 2 }, screenVideo: { layer: 0 } },
};

export const NETWORK_MEDIA_PROFILES: Record<NetworkMediaMode, MediaProfile> = {
  standard: {
    sendSettings: {
      video: { allowAdaptiveLayers: true },
      screenVideo: "default-screen-video",
    },
    receiveSettings: INITIAL_NETWORK_RECEIVE_SETTINGS,
    subscribeToVideo: true,
  },
  reduced: {
    sendSettings: {
      video: "bandwidth-optimized",
      screenVideo: "detail-optimized",
    },
    receiveSettings: {
      base: { video: { layer: 0 }, screenVideo: { layer: 0 } },
      "*": { video: { layer: 0 }, screenVideo: { layer: 0 } },
    },
    subscribeToVideo: true,
  },
  "audio-only": {
    sendSettings: {
      video: "bandwidth-optimized",
      screenVideo: "detail-optimized",
    },
    receiveSettings: {
      base: { video: { layer: 0 }, screenVideo: { layer: 0 } },
      "*": { video: { layer: 0 }, screenVideo: { layer: 0 } },
    },
    subscribeToVideo: false,
  },
};

export type NetworkMediaMemory = {
  localVideoWasOn: boolean;
};

export const INITIAL_NETWORK_MEDIA_MEMORY: NetworkMediaMemory = {
  localVideoWasOn: false,
};

type NetworkMediaCall = Pick<
  DailyCall,
  | "localScreenVideo"
  | "localVideo"
  | "participants"
  | "setLocalVideo"
  | "stopScreenShare"
  | "updateParticipant"
  | "updateParticipants"
  | "updateReceiveSettings"
  | "updateSendSettings"
>;

function subscriptionUpdate(subscribeToVideo: boolean) {
  return {
    setSubscribedTracks: {
      audio: true,
      video: subscribeToVideo,
      screenAudio: true,
      screenVideo: subscribeToVideo,
    },
  } as const;
}

function updateRemoteSubscriptions(
  call: NetworkMediaCall,
  subscribeToVideo: boolean
): void {
  const updates = Object.fromEntries(
    Object.entries(call.participants())
      .filter(([id, participant]) => id !== "local" && !participant.local)
      .map(([id]) => [id, subscriptionUpdate(subscribeToVideo)])
  );

  if (Object.keys(updates).length > 0) {
    call.updateParticipants(updates);
  }
}

export function applyParticipantNetworkMode(
  call: Pick<DailyCall, "updateParticipant">,
  sessionId: string,
  mode: NetworkMediaMode
): void {
  call.updateParticipant(
    sessionId,
    subscriptionUpdate(NETWORK_MEDIA_PROFILES[mode].subscribeToVideo)
  );
}

/**
 * Applies one policy transition to Daily. The caller serializes calls to this
 * function so a late low-quality Promise cannot overwrite a newer recovery.
 */
export async function applyNetworkMediaMode(
  call: NetworkMediaCall,
  mode: NetworkMediaMode,
  previousMode: NetworkMediaMode | null,
  memory: NetworkMediaMemory
): Promise<NetworkMediaMemory> {
  const profile = NETWORK_MEDIA_PROFILES[mode];
  const enteringAudioOnly =
    mode === "audio-only" && previousMode !== "audio-only";
  const leavingAudioOnly =
    mode !== "audio-only" && previousMode === "audio-only";
  let nextMemory = memory;

  if (enteringAudioOnly) {
    nextMemory = { localVideoWasOn: call.localVideo() };
    call.setLocalVideo(false);
    if (call.localScreenVideo()) call.stopScreenShare();
  }

  updateRemoteSubscriptions(call, profile.subscribeToVideo);

  const settingResults = await Promise.allSettled([
    call.updateSendSettings(profile.sendSettings),
    call.updateReceiveSettings(profile.receiveSettings),
  ]);

  if (leavingAudioOnly) {
    if (memory.localVideoWasOn) call.setLocalVideo(true);
    nextMemory = INITIAL_NETWORK_MEDIA_MEMORY;
  }

  for (const result of settingResults) {
    if (result.status === "rejected") {
      // Subscription and local-track changes above are synchronous and still
      // protect/restore the call. Treat a Daily quality-setting rejection as
      // non-fatal so the visible policy never lies about the camera state.
      console.warn(
        "[Qwickword] Daily media quality setting was not applied:",
        result.reason
      );
    }
  }

  return nextMemory;
}
