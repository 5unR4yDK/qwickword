import { expect, test } from "@playwright/test";
import type {
  DailyParticipantUpdateOptions,
  DailyReceiveSettings,
  DailyReceiveSettingsUpdates,
  DailySendSettings,
} from "@daily-co/daily-js";
import {
  applyNetworkMediaMode,
  BAD_NETWORK_GRACE_MS,
  INITIAL_NETWORK_MEDIA_MEMORY,
  INITIAL_NETWORK_POLICY,
  NETWORK_MEDIA_PROFILES,
  normalizeNetworkQuality,
  reduceNetworkPolicy,
  type NetworkPolicyEvent,
  type NetworkPolicyState,
} from "../../src/lib/network-degradation";

const run = (
  state: NetworkPolicyState,
  ...events: NetworkPolicyEvent[]
) => events.reduce(reduceNetworkPolicy, state);

test.describe("F6 network degradation policy", () => {
  test("weak video degrades immediately and sustained bad quality becomes audio-only", () => {
    const badAt = 10_000;
    const reduced = reduceNetworkPolicy(INITIAL_NETWORK_POLICY, {
      type: "QUALITY_CHANGED",
      quality: "bad",
      at: badAt,
    });
    expect(reduced).toEqual({
      quality: "bad",
      mode: "reduced",
      badSince: badAt,
    });

    expect(
      reduceNetworkPolicy(reduced, {
        type: "BAD_GRACE_EXPIRED",
        at: badAt + BAD_NETWORK_GRACE_MS - 1,
      }).mode
    ).toBe("reduced");

    expect(
      reduceNetworkPolicy(reduced, {
        type: "BAD_GRACE_EXPIRED",
        at: badAt + BAD_NETWORK_GRACE_MS,
      }).mode
    ).toBe("audio-only");
  });

  test("audio-only is sticky until the user explicitly restores video", () => {
    const audioOnly = run(
      INITIAL_NETWORK_POLICY,
      { type: "QUALITY_CHANGED", quality: "bad", at: 1000 },
      {
        type: "BAD_GRACE_EXPIRED",
        at: 1000 + BAD_NETWORK_GRACE_MS,
      },
      { type: "QUALITY_CHANGED", quality: "good", at: 9000 }
    );

    expect(audioOnly).toEqual({
      quality: "good",
      mode: "audio-only",
      badSince: null,
    });

    expect(
      reduceNetworkPolicy(audioOnly, {
        type: "RESTORE_VIDEO",
        at: 10_000,
      }).mode
    ).toBe("standard");
  });

  test("restoring during a bad assessment starts a fresh grace window", () => {
    const audioOnly = run(
      INITIAL_NETWORK_POLICY,
      { type: "QUALITY_CHANGED", quality: "bad", at: 1000 },
      {
        type: "BAD_GRACE_EXPIRED",
        at: 1000 + BAD_NETWORK_GRACE_MS,
      }
    );
    const retry = reduceNetworkPolicy(audioOnly, {
      type: "RESTORE_VIDEO",
      at: 20_000,
    });

    expect(retry).toEqual({
      quality: "bad",
      mode: "reduced",
      badSince: 20_000,
    });
  });

  test("both Daily middle-state names select reduced video", () => {
    expect(normalizeNetworkQuality("warning")).toBe("warning");
    expect(normalizeNetworkQuality("low")).toBe("low");
    expect(normalizeNetworkQuality("surprise")).toBe("unknown");

    for (const quality of ["warning", "low"] as const) {
      expect(
        reduceNetworkPolicy(INITIAL_NETWORK_POLICY, {
          type: "QUALITY_CHANGED",
          quality,
          at: 1000,
        }).mode
      ).toBe("reduced");
    }
  });

  test("Daily media settings preserve audio and restore only opted-in camera video", async () => {
    let localVideo = true;
    let screenVideo = true;
    let stoppedScreenShare = false;
    const sendSettings: DailySendSettings[] = [];
    const receiveSettings: DailyReceiveSettingsUpdates[] = [];
    const participantUpdates: Record<
      string,
      DailyParticipantUpdateOptions
    >[] = [];

    const call = {
      localVideo: () => localVideo,
      localScreenVideo: () => screenVideo,
      setLocalVideo: (enabled: boolean) => {
        localVideo = enabled;
        return call;
      },
      stopScreenShare: () => {
        screenVideo = false;
        stoppedScreenShare = true;
      },
      participants: () => ({
        local: { local: true },
        remote: { local: false },
      }),
      updateParticipant: () => call,
      updateParticipants: (
        updates: Record<string, DailyParticipantUpdateOptions>
      ) => {
        participantUpdates.push(updates);
        return call;
      },
      updateSendSettings: async (settings: DailySendSettings) => {
        sendSettings.push(settings);
        return settings;
      },
      updateReceiveSettings: async (
        settings: DailyReceiveSettingsUpdates
      ) => {
        receiveSettings.push(settings);
        return {} as DailyReceiveSettings;
      },
    };
    const mediaCall =
      call as unknown as Parameters<typeof applyNetworkMediaMode>[0];

    const memory = await applyNetworkMediaMode(
      mediaCall,
      "audio-only",
      "reduced",
      INITIAL_NETWORK_MEDIA_MEMORY
    );

    expect(localVideo).toBe(false);
    expect(stoppedScreenShare).toBe(true);
    expect(memory.localVideoWasOn).toBe(true);
    expect(sendSettings.at(-1)).toEqual(
      NETWORK_MEDIA_PROFILES["audio-only"].sendSettings
    );
    expect(receiveSettings.at(-1)).toEqual(
      NETWORK_MEDIA_PROFILES["audio-only"].receiveSettings
    );
    expect(
      participantUpdates.at(-1)?.remote.setSubscribedTracks
    ).toEqual({
      audio: true,
      video: false,
      screenAudio: true,
      screenVideo: false,
    });

    await applyNetworkMediaMode(
      mediaCall,
      "standard",
      "audio-only",
      memory
    );
    expect(localVideo).toBe(true);
    expect(
      participantUpdates.at(-1)?.remote.setSubscribedTracks
    ).toEqual({
      audio: true,
      video: true,
      screenAudio: true,
      screenVideo: true,
    });
  });

  test("a camera that was already off stays off after video restoration", async () => {
    let localVideo = false;
    const call = {
      localVideo: () => localVideo,
      localScreenVideo: () => false,
      setLocalVideo: (enabled: boolean) => {
        localVideo = enabled;
        return call;
      },
      stopScreenShare: () => {},
      participants: () => ({ local: { local: true } }),
      updateParticipant: () => call,
      updateParticipants: () => call,
      updateSendSettings: async (settings: DailySendSettings) => settings,
      updateReceiveSettings: async () => ({} as DailyReceiveSettings),
    } as unknown as Parameters<typeof applyNetworkMediaMode>[0];

    const memory = await applyNetworkMediaMode(
      call,
      "audio-only",
      "reduced",
      INITIAL_NETWORK_MEDIA_MEMORY
    );
    await applyNetworkMediaMode(call, "reduced", "audio-only", memory);

    expect(localVideo).toBe(false);
  });
});
