# Network-condition testing

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

## What CI proves

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

- Wi-Fi → cellular handoff during a live call.
- Airplane mode for 10 seconds, then recovery.
- App backgrounded for 10 minutes and reopened.
- An ordinary phone call interrupting Qwickword.
- AirPods connecting and disconnecting mid-call.
- A wired headset plugged in and removed mid-call.
- Low Power Mode and a nearly empty battery.

Record the device, OS/browser version, route before/after, visible state,
recovery time and whether teardown released camera/mic/headset resources.
