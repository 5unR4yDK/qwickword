"use client";

// The call page's live, ticking core: the call-object lifecycle, the
// prejoin/in-call/left state machine, the countdown/auto-start mechanics,
// and the hard swap to a "Time's up" screen once the shared `exp` passes.
// Owns a call-object-mode call directly (DailyIframe.createCallObject(), no
// iframe) with a full custom UI via @daily-co/daily-react — custom prejoin
// screen, video grid, overlay, and control bar (call-prejoin.tsx /
// call-video-grid.tsx / call-overlay.tsx / call-controls.tsx) rather than
// Daily's own hosted lobby + Prebuilt chrome.
//
// A few things worth calling out about the call-object lifecycle:
//  - Cross-tab waiting poll (durationSeconds-aware server-side auto-start).
//  - Clock-skew resync poll, plus the presence-based leave/empty-room
//    backstop (Daily's own /rooms/:name/presence, independent of any single
//    tab's own daily-js state).
//  - mockMode's no-API-key fallback (no real Daily call to create at all).
//
// There is deliberately no "vote to end early" / "end for everyone" control:
// ending a call for other participants without their consent is out of
// scope for this app.
//
// Start now is not a separate floating control — see call-controls.tsx,
// which owns it alongside microphone/camera/screen-share/end, at the same
// height and styling. This file only supplies the
// `started`/`starting`/`onStart` it needs.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import DailyIframe, {
  type DailyCall,
  type DailyEventObject,
} from "@daily-co/daily-js";
import { DailyAudio, DailyProvider, useParticipantCounts } from "@daily-co/daily-react";
import CallPrejoin from "@/components/call-prejoin";
import CallVideoGrid from "@/components/call-video-grid";
import CallControls from "@/components/call-controls";
import CallOverlay from "@/components/call-overlay";
import {
  initialCallState,
  isInCall,
  isTerminal,
  reduceCallState,
  remainingMs,
  type CallEvent,
} from "@/lib/call-state";
import {
  applyNetworkMediaMode,
  applyParticipantNetworkMode,
  BAD_NETWORK_GRACE_MS,
  INITIAL_NETWORK_MEDIA_MEMORY,
  INITIAL_NETWORK_POLICY,
  NETWORK_MEDIA_PROFILES,
  normalizeNetworkQuality,
  reduceNetworkPolicy,
  type NetworkMediaMode,
} from "@/lib/network-degradation";
import { createHttpTimingSink, Timings } from "@/lib/telemetry";
import {
  CallDiagnostics,
  createHttpDiagnosticSink,
} from "@/lib/call-diagnostics";
import {
  createInitialServerClockAnchor,
  createServerClockAnchor,
  monotonicNowMs,
  parseServerTimePayload,
  serverNowFromAnchor,
  type ClientTimeSample,
  type ServerClockAnchor,
} from "@/lib/server-clock";

type Props = {
  room: string;
  /**
   * The room's current live `exp` (Unix seconds) as of the server's last
   * check — see src/app/[room]/page.tsx. Before the countdown has started,
   * this is the generous pre-start buffer, not the real call length.
   */
  exp: number;
  /**
   * The intended call length in seconds, from the link's `d` query param.
   * `null` for a link minted before this feature existed — those links have
   * no waiting state at all (see `initialStarted`'s doc below).
   */
  durationSeconds: number | null;
  /**
   * Whether the real countdown has already started, per the server's own
   * live check (src/lib/daily-rooms.ts's `isCountdownStarted`). `false` means
   * this page should show the waiting state until a manual "Start now" click
   * or a second participant joining starts it.
   */
  initialStarted: boolean;
  /**
   * Remaining milliseconds computed by the server (page.tsx), using the
   * server's own clock at request time — see the equivalent prop's doc on
   * the pre-promotion version of this file for why this avoids a
   * hydration-mismatch risk and lets an already-expired link render the
   * ended screen on the very first response.
   */
  initialRemainingMs: number;
  mockMode: boolean;
  joinUrl: string | null;
  buildVersion: string;
};

type LiveSyncSource = "status_poll" | "foreground" | "reconnect";

/**
 * Lives inside DailyProvider so it can use daily-react's participant-count
 * hook — mirrors the old iframe flow's "second participant joined, start the
 * countdown" auto-start. Renders nothing; it's a side-effect-only watcher.
 */
function ParticipantWatcher({
  onParticipantCount,
}: {
  onParticipantCount: (count: number) => void;
}) {
  const counts = useParticipantCounts();
  useEffect(() => {
    onParticipantCount(counts.present);
  }, [counts.present, onParticipantCount]);
  return null;
}

function NetworkStatus({
  mode,
  onRestoreVideo,
}: {
  mode: Exclude<NetworkMediaMode, "standard">;
  onRestoreVideo: () => void;
}) {
  const audioOnly = mode === "audio-only";
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute top-28 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-center text-xs text-white/85 shadow-lg backdrop-blur sm:text-sm"
    >
      <span>
        {audioOnly
          ? "Audio-only mode. Video paused to keep the call clear."
          : "Weak connection. Video quality reduced to protect audio."}
      </span>
      {audioOnly && (
        <button
          type="button"
          onClick={onRestoreVideo}
          className="shrink-0 cursor-pointer rounded-full bg-white/15 px-3 py-1 font-semibold text-white transition-colors hover:bg-white/25"
        >
          Try video again
        </button>
      )}
    </div>
  );
}

function ProblemReportButton({
  onReport,
}: {
  onReport: () => Promise<string | null>;
}) {
  const [reference, setReference] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [failed, setFailed] = useState(false);

  const requestReference = useCallback(async () => {
    if (requesting || reference) return;
    setRequesting(true);
    setFailed(false);
    const result = await onReport();
    setReference(result);
    setFailed(result === null);
    setRequesting(false);
  }, [onReport, reference, requesting]);

  if (reference) {
    return (
      <p className="text-xs text-white/55" role="status">
        Support code: <span className="font-mono text-white/80">{reference}</span>
        {" · kept for 14 days"}
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => void requestReference()}
        disabled={requesting}
        className="cursor-pointer text-xs text-white/50 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white/75 disabled:cursor-wait"
      >
        {requesting ? "Creating support code…" : "Report a timing problem"}
      </button>
      {failed && (
        <p className="text-xs text-white/45" role="status">
          A support code could not be created. Please try again.
        </p>
      )}
    </div>
  );
}

function LeftScreen({
  preStart,
  onReport,
}: {
  preStart: boolean;
  onReport: () => Promise<string | null>;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      <p className="text-lg font-medium">You&apos;ve left this call.</p>
      <p className="max-w-sm text-sm text-white/60">
        {preStart
          ? "The call never started, so this link is done. Anyone opening it now will see that it's over."
          : "It may still be running for anyone else still in it. There's no way back into this one."}
      </p>
      <Link
        href="/"
        className="mt-2 cursor-pointer rounded-full bg-[#3DFEF1] px-5 py-2 text-sm font-semibold text-[#062B28] transition-colors hover:bg-[#7FFFF5]"
      >
        Create a new one
      </Link>
      <ProblemReportButton onReport={onReport} />
    </div>
  );
}

function EndedScreen({ onReport }: { onReport: () => Promise<string | null> }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-7 overflow-hidden bg-black px-6 text-center text-white">
      {/* Faint ambient glow behind the content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.09)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/wordmark-only.svg"
        alt="qwickword.com"
        className="relative z-10 h-auto w-[300px] max-w-[80vw] opacity-80"
      />
      <p className="relative z-10 text-[22px] font-medium text-[#FAFAFA]">
        This Qwickword has ended.
      </p>
      <Link
        href="/"
        className="relative z-10 flex h-12 cursor-pointer items-center rounded-full bg-[#3DFEF1] px-[26px] text-[15px] font-semibold text-[#062B28] transition-colors duration-150 hover:bg-[#7FFFF5]"
      >
        Create a new one
      </Link>
      <div className="relative z-10">
        <ProblemReportButton onReport={onReport} />
      </div>
    </div>
  );
}

function FailedScreen({
  message,
  onReport,
}: {
  message: string | null;
  onReport: () => Promise<string | null>;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      <p className="text-lg font-medium">This call ended unexpectedly.</p>
      <p className="max-w-sm text-sm text-white/60">
        {message ?? "The connection could not be recovered."}
      </p>
      <Link
        href="/"
        className="mt-2 cursor-pointer rounded-full bg-[#3DFEF1] px-5 py-2 text-sm font-semibold text-[#062B28] transition-colors hover:bg-[#7FFFF5]"
      >
        Create a new one
      </Link>
      <ProblemReportButton onReport={onReport} />
    </div>
  );
}

export default function CallRoom({
  room,
  exp,
  durationSeconds,
  initialStarted,
  initialRemainingMs,
  mockMode,
  joinUrl,
  buildVersion,
}: Props) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [state, dispatch] = useReducer(
    reduceCallState,
    {
      durationSeconds: durationSeconds ?? 0,
      expiresAt: initialStarted ? exp * 1000 : null,
      joined: mockMode,
      alreadyEnded: initialStarted && initialRemainingMs <= 0,
    },
    initialCallState
  );
  const [networkPolicy, dispatchNetworkPolicy] = useReducer(
    reduceNetworkPolicy,
    INITIAL_NETWORK_POLICY
  );
  // This is only a projection clock for the countdown display. Lifecycle
  // truth lives in `state`; the initial value is derived entirely from server
  // props so the first server and client renders remain identical.
  const [clockNowMs, setClockNowMs] = useState(() =>
    initialStarted ? exp * 1000 - initialRemainingMs : 0
  );
  const clockAnchorRef = useRef<ServerClockAnchor | null>(
    initialStarted
      ? createInitialServerClockAnchor(
          exp * 1000,
          initialRemainingMs,
          monotonicNowMs()
        )
      : null
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const callObjectRef = useRef<DailyCall | null>(null);
  const callObjectDestroyedRef = useRef(false);
  const teardownStartedRef = useRef(false);
  const startRequestRef = useRef(false);
  const reconnectOpenRef = useRef(false);
  const hasRecordedClockSyncRef = useRef(false);
  const networkModeRef = useRef<NetworkMediaMode>(networkPolicy.mode);
  const liveStatusRefreshRef = useRef<
    ((source?: LiveSyncSource) => Promise<void>) | null
  >(null);
  const appliedNetworkModeRef = useRef<NetworkMediaMode | null>(null);
  const networkMediaMemoryRef = useRef(INITIAL_NETWORK_MEDIA_MEMORY);
  const networkSettingsQueueRef = useRef<Promise<void>>(Promise.resolve());

  const synchronizedNowMs = useCallback(() => {
    const anchor = clockAnchorRef.current;
    return anchor
      ? serverNowFromAnchor(anchor, monotonicNowMs())
      : Date.now();
  }, []);

  useEffect(() => {
    networkModeRef.current = networkPolicy.mode;
  }, [networkPolicy.mode]);

  const timingSink = useMemo(
    () => createHttpTimingSink({ endpoint: "/api/telemetry" }),
    []
  );
  const timings = useMemo(() => new Timings(room, timingSink), [room, timingSink]);
  const diagnosticSink = useMemo(
    () => createHttpDiagnosticSink({ endpoint: "/api/telemetry" }),
    []
  );
  const diagnostics = useMemo(
    () => new CallDiagnostics(room, diagnosticSink, buildVersion),
    [buildVersion, diagnosticSink, room]
  );

  const requestIncidentReference = useCallback(async () => {
    diagnostics.record("problem_report.requested", {
      phase: stateRef.current.phase,
      authoritativeExpMs: stateRef.current.expiresAt ?? undefined,
    });
    diagnosticSink.flush();
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(room)}/incident`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientCallSessionId: diagnostics.sessionId,
            surface: "web",
            appVersion: buildVersion,
          }),
        }
      );
      if (!response.ok) return null;
      const body = (await response.json()) as { reference?: unknown };
      return typeof body.reference === "string" ? body.reference : null;
    } catch {
      return null;
    }
  }, [buildVersion, diagnosticSink, diagnostics, room]);

  useEffect(() => {
    diagnostics.record("call.opened", {
      phase: stateRef.current.phase,
      authoritativeExpMs: stateRef.current.expiresAt ?? undefined,
    });
    const handleVisibilityChange = () => {
      diagnostics.record(
        document.visibilityState === "visible"
          ? "app.foregrounded"
          : "app.backgrounded",
        {
          phase: stateRef.current.phase,
          authoritativeExpMs: stateRef.current.expiresAt ?? undefined,
        }
      );
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [diagnostics]);

  const emit = useCallback(
    (event: CallEvent) => {
      const current = stateRef.current;
      switch (event.type) {
        case "JOIN":
          timings.start("join_to_audio");
          diagnostics.record("media.join_requested", { phase: current.phase });
          break;
        case "JOINED":
          timings.end("join_to_audio");
          diagnostics.record("media.joined", { phase: current.phase });
          break;
        case "JOIN_FAILED":
          timings.cancel("join_to_audio");
          break;
        case "TRANSPORT_LOST":
          if (!reconnectOpenRef.current) {
            reconnectOpenRef.current = true;
            timings.start("reconnect");
          }
          diagnostics.record("transport.reconnecting", {
            phase: current.phase,
          });
          break;
        case "TRANSPORT_RECOVERED":
          if (reconnectOpenRef.current) {
            reconnectOpenRef.current = false;
            timings.end("reconnect");
          }
          diagnostics.record("transport.recovered", {
            phase: current.phase,
          });
          break;
        case "TRANSPORT_LEFT": {
          const nearExpiry =
            current.expiresAt !== null &&
            event.at + 1500 >= current.expiresAt;
          diagnostics.record("transport.left", {
            phase: current.phase,
            authoritativeExpMs: current.expiresAt ?? undefined,
            endTrigger: nearExpiry ? "provider_eject" : "transport_failure",
          });
          break;
        }
        case "EXPIRED":
          diagnostics.record("countdown.local_zero", {
            phase: current.phase,
            authoritativeExpMs: current.expiresAt ?? undefined,
            endTrigger: "server_deadline",
          });
          diagnostics.record("call.end_requested", {
            phase: current.phase,
            authoritativeExpMs: current.expiresAt ?? undefined,
            endTrigger: "server_deadline",
          });
          break;
        case "LEAVE":
          diagnostics.record("call.end_requested", {
            phase: current.phase,
            authoritativeExpMs: current.expiresAt ?? undefined,
            endTrigger:
              current.expiresAt === null
                ? "abandoned_before_start"
                : "manual_leave",
          });
          break;
        case "TEARDOWN_COMPLETE":
          diagnostics.record("call.teardown_completed", {
            phase: current.phase,
            authoritativeExpMs: current.expiresAt ?? undefined,
          });
          break;
        case "FATAL":
          reconnectOpenRef.current = false;
          timings.cancel("join_to_audio");
          timings.cancel("reconnect");
          diagnostics.record("call.failed", {
            phase: current.phase,
            endTrigger: "fatal_error",
            errorCategory: "transport_fatal",
          });
          break;
      }
      dispatch(event);
    },
    [diagnostics, timings]
  );

  // Stats only — never gates the call itself, so every failure path here is
  // a silent no-op. One report per tab per call; the server keeps only the
  // first one it receives across all tabs.
  const endReportedRef = useRef(false);
  const reportEnd = useCallback(
    (reason: "completed" | "left_early") => {
      if (endReportedRef.current || mockMode) return;
      endReportedRef.current = true;
      void fetch(`/api/rooms/${room}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        keepalive: true,
      }).catch(() => {});
    },
    [mockMode, room]
  );

  const enqueueNetworkMode = useCallback(
    (co: DailyCall, mode: NetworkMediaMode) => {
      networkSettingsQueueRef.current = networkSettingsQueueRef.current
        .then(async () => {
          if (
            callObjectRef.current !== co ||
            callObjectDestroyedRef.current
          ) {
            return;
          }
          networkMediaMemoryRef.current = await applyNetworkMediaMode(
            co,
            mode,
            appliedNetworkModeRef.current,
            networkMediaMemoryRef.current
          );
          appliedNetworkModeRef.current = mode;
        })
        .catch((err) => {
          // Media adaptation must never become a fatal call error. Daily's
          // own adaptive transport remains in place if a settings update
          // fails, and the next quality transition gets another chance.
          console.warn(
            "[Qwickword] Failed to apply network media policy:",
            err
          );
        });
    },
    []
  );

  // Call-object mode: create the transport once and translate every Daily
  // lifecycle event into the explicit state machine. Provider-specific event
  // strings live here and nowhere in the UI.
  useEffect(() => {
    if (mockMode) return;
    const co = DailyIframe.createCallObject({
      sendSettings: NETWORK_MEDIA_PROFILES.standard.sendSettings,
    });
    callObjectRef.current = co;
    callObjectDestroyedRef.current = false;

    const handleJoined = () => emit({ type: "JOINED" });
    const handleLeft = () =>
      emit({ type: "TRANSPORT_LEFT", at: synchronizedNowMs() });
    const handleNetwork = (
      event: DailyEventObject<"network-connection">
    ) => {
      if (event.event === "interrupted") emit({ type: "TRANSPORT_LOST" });
      if (event.event === "connected") {
        emit({ type: "TRANSPORT_RECOVERED", at: synchronizedNowMs() });
        void liveStatusRefreshRef.current?.("reconnect");
      }
    };
    const handleNetworkQuality = (
      event: DailyEventObject<"network-quality-change">
    ) => {
      if (!isInCall(stateRef.current)) return;
      dispatchNetworkPolicy({
        type: "QUALITY_CHANGED",
        quality: normalizeNetworkQuality(event.networkState),
        at: Date.now(),
      });
    };
    const handleParticipantJoined = (
      event: DailyEventObject<"participant-joined">
    ) => {
      if (
        !event.participant.local &&
        networkModeRef.current === "audio-only"
      ) {
        applyParticipantNetworkMode(
          co,
          event.participant.session_id,
          "audio-only"
        );
      }
    };
    const handleError = (event: DailyEventObject<"error">) => {
      const message = event.errorMsg || "The call connection failed.";
      emit(
        stateRef.current.phase === "joining"
          ? { type: "JOIN_FAILED", message }
          : { type: "FATAL", message }
      );
    };

    co.on("joined-meeting", handleJoined);
    co.on("left-meeting", handleLeft);
    co.on("network-connection", handleNetwork);
    co.on("network-quality-change", handleNetworkQuality);
    co.on("participant-joined", handleParticipantJoined);
    co.on("error", handleError);

    const id = setTimeout(() => {
      setCallObject(co);
      emit({ type: "PREPARE" });
    }, 0);
    return () => {
      clearTimeout(id);
      co.off("joined-meeting", handleJoined);
      co.off("left-meeting", handleLeft);
      co.off("network-connection", handleNetwork);
      co.off("network-quality-change", handleNetworkQuality);
      co.off("participant-joined", handleParticipantJoined);
      co.off("error", handleError);
      if (callObjectRef.current === co) callObjectRef.current = null;
      if (!callObjectDestroyedRef.current) {
        void co.destroy().catch((err) => {
          console.error("[Qwickword] Failed to destroy the call object:", err);
        });
      }
    };
  }, [emit, mockMode, synchronizedNowMs]);

  useEffect(() => {
    if (!callObject) return;
    enqueueNetworkMode(callObject, networkPolicy.mode);
  }, [callObject, enqueueNetworkMode, networkPolicy.mode]);

  useEffect(() => {
    if (
      networkPolicy.quality !== "bad" ||
      networkPolicy.mode === "audio-only" ||
      networkPolicy.badSince === null
    ) {
      return;
    }
    const delay = Math.max(
      0,
      networkPolicy.badSince + BAD_NETWORK_GRACE_MS - Date.now()
    );
    const id = setTimeout(() => {
      dispatchNetworkPolicy({
        type: "BAD_GRACE_EXPIRED",
        at: Date.now(),
      });
    }, delay);
    return () => clearTimeout(id);
  }, [
    networkPolicy.badSince,
    networkPolicy.mode,
    networkPolicy.quality,
  ]);

  // All exit paths converge here: manual leave, expiry, a forced transport
  // exit, or a fatal error. `teardown` ends only after leave + destroy have
  // released Daily's media resources, which is the ghost-call measurement we
  // actually care about.
  useEffect(() => {
    if (state.phase !== "ending" || teardownStartedRef.current) return;
    teardownStartedRef.current = true;
    let active = true;
    if (!mockMode) timings.start("teardown");

    void (async () => {
      const co = callObjectRef.current;
      try {
        await co?.leave();
      } catch (err) {
        console.error("[Qwickword] Failed to leave the call cleanly:", err);
      }
      try {
        await co?.destroy();
      } catch (err) {
        console.error("[Qwickword] Failed to release call media:", err);
      } finally {
        if (co) callObjectDestroyedRef.current = true;
        if (callObjectRef.current === co) callObjectRef.current = null;
        if (!mockMode) {
          timings.end("teardown");
          timingSink.flush();
        }
        if (active) {
          setCallObject(null);
          emit({ type: "TEARDOWN_COMPLETE" });
          diagnosticSink.flush();
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [diagnosticSink, emit, mockMode, state.phase, timingSink, timings]);

  useEffect(
    () => () => {
      timingSink.flush();
      timings.discard();
      diagnosticSink.flush();
      diagnosticSink.discard();
    },
    [diagnosticSink, timingSink, timings]
  );

  const applyCountdownStarted = useCallback(
    (
      raw: unknown,
      sample: ClientTimeSample,
      source: "start_response" | LiveSyncSource
    ) => {
      const payload = parseServerTimePayload(raw);
      if (!payload) {
        throw new Error("The server returned an invalid countdown clock.");
      }
      const anchor = createServerClockAnchor(payload, sample);
      if (!anchor) {
        throw new Error("The server returned an invalid countdown clock.");
      }
      const previousAnchor = clockAnchorRef.current;
      const previousRemainingMs = previousAnchor
        ? Math.max(
            0,
            previousAnchor.authoritativeExpMs -
              serverNowFromAnchor(
                previousAnchor,
                sample.responseReceivedMonotonicMs
              )
          )
        : null;
      const nextRemainingMs = Math.max(
        0,
        anchor.authoritativeExpMs - anchor.estimatedServerAtReceiptMs
      );
      const deadlineShiftMs =
        previousRemainingMs === null
          ? Number.POSITIVE_INFINITY
          : Math.abs(nextRemainingMs - previousRemainingMs);
      clockAnchorRef.current = anchor;
      setClockNowMs(
        serverNowFromAnchor(anchor, sample.responseReceivedMonotonicMs)
      );
      const expiresAt = payload.exp * 1000;
      if (stateRef.current.expiresAt !== expiresAt) {
        emit({ type: "COUNTDOWN_STARTED", expiresAt });
      }
      if (
        !hasRecordedClockSyncRef.current ||
        previousAnchor?.authoritativeExpMs !== anchor.authoritativeExpMs ||
        deadlineShiftMs > 1000
      ) {
        diagnostics.recordClockSync(
          hasRecordedClockSyncRef.current
            ? "countdown.sync_changed"
            : "countdown.sync_applied",
          anchor,
          {
            phase: stateRef.current.phase,
            source,
            participantCount: stateRef.current.participantCount,
            serverReceivedAtMs: payload.serverReceivedAtMs,
            serverNowMs: payload.serverNowMs,
          }
        );
        hasRecordedClockSyncRef.current = true;
      }
    },
    [diagnostics, emit]
  );

  const triggerStart = useCallback(async (
    startSource: "manual_start" | "second_participant" = "manual_start"
  ) => {
    if (
      startRequestRef.current ||
      stateRef.current.expiresAt !== null ||
      !durationSeconds
    ) {
      return;
    }
    startRequestRef.current = true;
    diagnostics.record("countdown.start_requested", {
      phase: stateRef.current.phase,
      source: startSource,
      participantCount: stateRef.current.participantCount,
    });
    emit({ type: "COUNTDOWN_STARTING" });
    try {
      const requestStartedMonotonicMs = monotonicNowMs();
      const response = await fetch(`/api/rooms/${room}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds, source: startSource }),
      });
      const data = await response.json();
      const responseReceivedMonotonicMs = monotonicNowMs();
      const clientWallAtReceiptMs = Date.now();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't start the countdown."
        );
      }
      applyCountdownStarted(
        data,
        {
          requestStartedMonotonicMs,
          responseReceivedMonotonicMs,
          clientWallAtReceiptMs,
        },
        "start_response"
      );
    } catch (err) {
      emit({
        type: "COUNTDOWN_FAILED",
        message:
          err instanceof TypeError
            ? "Couldn't reach the server. Check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Couldn't start the countdown.",
      });
    } finally {
      startRequestRef.current = false;
    }
  }, [applyCountdownStarted, diagnostics, durationSeconds, emit, room]);

  const handleParticipantCount = useCallback(
    (count: number) => {
      emit({ type: "PARTICIPANT_COUNT", count });
      if (count >= 2) void triggerStart("second_participant");
    },
    [emit, triggerStart]
  );

  // Project the server-owned absolute expiry through a monotonic client
  // anchor and emit EXPIRED exactly through the machine. Device wall time is
  // deliberately absent: a manually fast/slow clock cannot end one side early
  // or late.
  useEffect(() => {
    if (
      state.expiresAt === null ||
      state.phase === "ending" ||
      isTerminal(state.phase)
    ) {
      return;
    }
    const expiresAt = state.expiresAt;
    const tick = () => {
      const anchor = clockAnchorRef.current;
      if (!anchor) return;
      const now = serverNowFromAnchor(anchor, monotonicNowMs());
      setClockNowMs(now);
      if (now >= expiresAt) emit({ type: "EXPIRED" });
    };
    const immediateId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediateId);
      clearInterval(intervalId);
    };
  }, [emit, state.expiresAt, state.phase]);

  // Picks up a start triggered from a *different* tab, and carries
  // `durationSeconds` so the status route can auto-start the room
  // server-side once Daily's own presence count hits 2, independent of
  // whether any tab's own daily-js detection worked. Skipped once started,
  // for a link with no duration, or in mock mode (no persisted room to poll).
  useEffect(() => {
    if (state.expiresAt !== null || !durationSeconds || mockMode) return;
    const id = setInterval(async () => {
      try {
        const requestStartedMonotonicMs = monotonicNowMs();
        const response = await fetch(
          `/api/rooms/${room}/status?fallbackExp=${exp}&durationSeconds=${durationSeconds}`
        );
        if (!response.ok) return;
        const data = await response.json();
        const responseReceivedMonotonicMs = monotonicNowMs();
        if (data.started && typeof data.exp === "number") {
          applyCountdownStarted(
            data,
            {
              requestStartedMonotonicMs,
              responseReceivedMonotonicMs,
              clientWallAtReceiptMs: Date.now(),
            },
            "status_poll"
          );
        }
      } catch {
        // Transient — the next poll gets another chance.
      }
    }, 4000);
    return () => clearInterval(id);
  }, [
    applyCountdownStarted,
    durationSeconds,
    exp,
    mockMode,
    room,
    state.expiresAt,
  ]);

  // Re-syncs `currentExp` against Daily's own live room status once the
  // countdown has started (corrects client-clock drift against Daily's own
  // server-side eject_at_room_exp enforcement), and doubles as the
  // presence-based leave/empty-room backstop: if Daily reports nobody
  // currently present, this tab can't still be genuinely connected either,
  // whatever its own local leave-detection thinks. `emptyPollStreakRef`
  // requires two consecutive 0-counts (20s) before acting, so a single
  // transient/propagation-delay reading right after joining can't cause a
  // false positive. Skipped in mock mode — no persisted room to poll.
  const emptyPollStreakRef = useRef(0);
  useEffect(() => {
    if (
      state.expiresAt === null ||
      mockMode ||
      state.phase === "ending" ||
      isTerminal(state.phase)
    ) {
      return;
    }
    const currentExpSeconds = state.expiresAt / 1000;
    const refresh = async (syncSource: LiveSyncSource = "status_poll") => {
      try {
        const requestStartedMonotonicMs = monotonicNowMs();
        const response = await fetch(
          `/api/rooms/${room}/status?fallbackExp=${currentExpSeconds}`
        );
        if (!response.ok) return;
        const data = await response.json();
        const responseReceivedMonotonicMs = monotonicNowMs();
        if (data.started && typeof data.exp === "number") {
          // Re-anchor even when the authoritative expiry is unchanged. The
          // new server sample corrects local suspension or oscillator drift.
          applyCountdownStarted(
            data,
            {
              requestStartedMonotonicMs,
              responseReceivedMonotonicMs,
              clientWallAtReceiptMs: Date.now(),
            },
            syncSource
          );
        }
        if (typeof data.presentCount === "number") {
          emit({ type: "PARTICIPANT_COUNT", count: data.presentCount });
        }
        if (data.presentCount === 0) {
          emptyPollStreakRef.current += 1;
          if (
            emptyPollStreakRef.current >= 2 &&
            isInCall(stateRef.current)
          ) {
            emit({ type: "TRANSPORT_LEFT", at: synchronizedNowMs() });
          }
        } else {
          emptyPollStreakRef.current = 0;
        }
      } catch {
        // Transient — the next poll gets another chance.
      }
    };
    liveStatusRefreshRef.current = refresh;
    // Synchronize immediately on mount/foregrounded navigation, then every
    // ten seconds while live.
    void refresh("status_poll");
    const id = setInterval(() => void refresh("status_poll"), 10_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh("foreground");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (liveStatusRefreshRef.current === refresh) {
        liveStatusRefreshRef.current = null;
      }
    };
  }, [
    applyCountdownStarted,
    emit,
    mockMode,
    room,
    state.expiresAt,
    state.phase,
    synchronizedNowMs,
  ]);

  const started = state.expiresAt !== null;
  const displayedRemainingMs =
    remainingMs(state, clockNowMs) ?? initialRemainingMs;

  // The call ran its full length. Reported from whichever tabs are still
  // open when the clock hits zero; if every participant closed out first,
  // nothing fires and the row stays "started, outcome unknown" rather than
  // being wrongly counted as completed.
  useEffect(() => {
    if (state.phase === "ending" && state.endReason === "completed") {
      reportEnd("completed");
    }
  }, [reportEnd, state.endReason, state.phase]);

  // Leaving before the countdown ever started abandons the room: if this
  // was the only person waiting, the server retires (deletes) it so a later
  // visitor sees the "ended" screen instead of a waiting room nobody is
  // coming back to. Fire-and-forget — the server double-checks the started
  // state and presence itself, so a stale/failed call here just means the
  // room quietly rots out via its 24h buffer instead.
  const handleLeave = useCallback(() => {
    const current = stateRef.current;
    if (current.expiresAt === null && !mockMode) {
      void fetch(`/api/rooms/${room}/abandon`, { method: "POST" }).catch(
        () => {}
      );
    }
    // Walking out of a call that was already running is the one signal that
    // separates "sat through it" from "bailed". Only report while time
    // remains: leaving after the timer has run out is just closing an ended
    // call, and `reportEnd` guards the completed case separately.
    if (
      current.expiresAt !== null &&
      synchronizedNowMs() < current.expiresAt
    ) {
      reportEnd("left_early");
    }
    emit({ type: "LEAVE" });
  }, [emit, mockMode, reportEnd, room, synchronizedNowMs]);

  const restoreVideo = useCallback(() => {
    dispatchNetworkPolicy({ type: "RESTORE_VIDEO", at: Date.now() });
  }, []);

  if (state.phase === "ending" || state.phase === "ended" || state.phase === "failed") {
    if (state.endReason === "completed") {
      return <EndedScreen onReport={requestIncidentReference} />;
    }
    if (state.endReason === "left_early" || state.endReason === "abandoned") {
      return (
        <LeftScreen
          preStart={state.endReason === "abandoned"}
          onReport={requestIncidentReference}
        />
      );
    }
    return (
      <FailedScreen
        message={state.error}
        onReport={requestIncidentReference}
      />
    );
  }

  if (mockMode) {
    // No API key configured — there's no real Daily call to create, so this
    // renders a simplified stand-in that still exercises the countdown/
    // start mechanics (all server-route-driven, not dependent on a real
    // daily-js connection) without any camera/mic/video UI.
    return (
      <div className="relative h-full w-full bg-black">
        <CallOverlay remainingMs={displayedRemainingMs} started={started} />
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-white">
          <p className="text-base font-medium">Mock call: no Daily API key configured</p>
          <p className="text-sm text-white/60">Room: {room}</p>
        </div>
        {!started && durationSeconds && (
          <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-3 backdrop-blur"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
          >
            <button
              type="button"
              onClick={() => void triggerStart()}
              disabled={state.countdownStarting}
              className="flex h-11 cursor-pointer items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:enabled:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.countdownStarting ? "Starting…" : "Start now"}
            </button>
          </div>
        )}
        {state.error && (
          <p
            role="alert"
            className="absolute left-1/2 -translate-x-1/2 text-sm text-red-400"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
          >
            {state.error}
          </p>
        )}
      </div>
    );
  }

  if (!joinUrl) {
    // Shouldn't happen — page.tsx only ever passes a null joinUrl alongside
    // mockMode: true, handled above — but keeps this branch total rather
    // than letting CallPrejoin below receive a null join URL.
    return (
      <div className="flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-white/60">
        Something went wrong setting up this call. Try reloading the page.
      </div>
    );
  }

  if (!callObject) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <DailyAudio />
      {!isInCall(state) && (
        <CallPrejoin
          joinUrl={joinUrl}
          durationSeconds={durationSeconds ?? undefined}
          phase={state.phase}
          error={state.error}
          onEvent={emit}
        />
      )}
      {isInCall(state) && (
        <>
          <ParticipantWatcher onParticipantCount={handleParticipantCount} />
          <CallVideoGrid />
          <CallOverlay remainingMs={displayedRemainingMs} started={started} />
          {state.phase !== "reconnecting" &&
            networkPolicy.mode !== "standard" && (
              <NetworkStatus
                mode={networkPolicy.mode}
                onRestoreVideo={restoreVideo}
              />
            )}
          <CallControls
            onLeave={handleLeave}
            started={started}
            starting={state.countdownStarting}
            onStart={() => void triggerStart()}
            audioOnly={networkPolicy.mode === "audio-only"}
            onVideoOverride={restoreVideo}
          />

          {state.phase === "reconnecting" && (
            <p
              role="status"
              className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm text-white/80 backdrop-blur"
            >
              Reconnecting…
            </p>
          )}

          {state.error && (
            <p
              role="alert"
              className="absolute left-1/2 -translate-x-1/2 text-sm text-red-400"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
            >
              {state.error}
            </p>
          )}
        </>
      )}
    </DailyProvider>
  );
}
