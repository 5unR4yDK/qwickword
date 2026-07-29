# Network degradation and condition testing

F6 defines how a live call protects audio when Daily reports a poor network.
F7 makes bad connections a named, repeatable part of the web test suite rather
than an occasional manual experiment.

## Run it

```bash
npm run test:e2e:network
```

The normal `npm run test:e2e` command and GitHub CI include the same scenarios.
The Playwright server runs with Daily and database credentials blank, so the
suite provisions no Daily rooms and writes no product analytics.

## Automated profiles

`tests/e2e/fixtures/network.ts` applies profiles through Chromium's DevTools
protocol to both requests and `navigator.onLine`:

- `healthy` — no latency or throughput limit; also the cleanup state.
- `slowMobile` — 650 ms latency, 48 KiB/s down and 16 KiB/s up.
- `offline` — no requests can leave the page and `navigator.onLine` is false.

The profile values are centralized so future tests do not grow arbitrary sleeps
or subtly different definitions of “slow.”

## Live-call degradation policy

The call client listens to Daily's `network-quality-change` event and uses
`networkState`; the older numeric `quality` and `threshold` fields are
deliberately ignored.

- `good` — Daily Adaptive Bitrate is enabled, camera receive quality may use the
  highest simulcast layer, and video subscriptions stay on.
- `warning` or `low` — immediately use Daily's `bandwidth-optimized` camera
  preset, `detail-optimized` screen share, and the lowest receive layer. The
  call shows that video quality was reduced to protect audio.
- `bad` — apply the reduced profile immediately. If the assessment remains bad
  for five seconds, pause the local camera and screen share and unsubscribe from
  remote camera/screen video while keeping all audio subscribed.
- `unknown` — do not treat missing evidence as a recovery.

Audio-only mode is sticky even after Daily reports a good connection. The call
shows what happened and offers **Try video again**. That explicit action restores
video subscriptions and only turns the local camera back on if it was on before
the automatic pause. If the network is still bad, the five-second grace starts
again. Automatic degradation never changes the visitor's remembered camera
preference.

## What CI proves

- The F6 state tests prove immediate weak-network degradation, the five-second
  bad-network grace, sticky audio-only behavior, explicit restoration and a
  fresh grace window after an override.
- The F6 Daily-adapter tests prove audio remains subscribed, remote video is
  unsubscribed in audio-only mode, screen sharing stops, and a camera that was
  already off is not silently enabled during restoration.
- A room-creation request that begins offline fails with actionable copy and
  succeeds from the same UI after connectivity returns.
- Slow mobile creation remains single-flight while every duration control is
  disabled.
- A countdown-start request can fail offline and be retried after recovery.
- A countdown already anchored to an absolute server expiry reaches the terminal
  screen even if the browser is offline.
- The pure call-state suite separately proves transport loss/recovery, recovery
  after expiry, forced transport exit, duplicate events and terminal-state
  absorption. Those tests model Daily event ordering without using credentials.

## Manual device matrix

These remain physical-device tests; a browser harness cannot honestly simulate
them:

- Wi-Fi → cellular handoff: the call should show reduced video before
  audio-only, preserve speech, and remain joined.
- Airplane mode for 10 seconds, then recovery: the reconnecting state should
  appear, the absolute countdown must keep running, and **Try video again**
  should be available if the call entered audio-only.
- App backgrounded for 10 minutes and reopened.
- An ordinary phone call interrupting Qwickword.
- AirPods connecting and disconnecting mid-call.
- A wired headset plugged in and removed mid-call.
- Low Power Mode and a nearly empty battery.

Record the device, OS/browser version, route before/after, visible state,
recovery time and whether teardown released camera/mic/headset resources.
