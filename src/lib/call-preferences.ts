// Pre-call device/sound preferences, chosen from the home page's settings
// menu (src/components/settings-menu.tsx) and applied automatically once a
// call actually starts (src/components/call-prejoin.tsx, src/components/
// call-overlay.tsx). *(Roadmap: "Settings menu on the home page... ability
// to set sound and video there so you dont do it while the clock is
// ticking," 2026-07-21, Andreas, interactive.)*
//
// Same no-account approach already established for dark mode
// (theme-toggle.tsx): plain localStorage, per-browser, no server-side state,
// no new datastore. Not a real user "session" — Andreas was explicit there
// are no accounts anywhere in this app.

const CAMERA_KEY = "qwickword-preferred-camera";
const MIC_KEY = "qwickword-preferred-mic";
const COUNTDOWN_SOUND_KEY = "qwickword-countdown-sound";

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage unavailable (private browsing, disabled) — callers just fall
    // back to "no preference set" / the default.
    return null;
  }
}

function writeString(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Storage unavailable — the choice just won't be remembered next visit.
  }
}

export function getPreferredCameraId(): string | null {
  return readString(CAMERA_KEY);
}

export function setPreferredCameraId(deviceId: string | null): void {
  writeString(CAMERA_KEY, deviceId);
}

export function getPreferredMicId(): string | null {
  return readString(MIC_KEY);
}

export function setPreferredMicId(deviceId: string | null): void {
  writeString(MIC_KEY, deviceId);
}

/** Defaults to on — matches the countdown tick's existing always-on behavior
 * before this preference existed, so nobody's experience changes unless they
 * actively turn it off. */
export function getCountdownSoundEnabled(): boolean {
  return readString(COUNTDOWN_SOUND_KEY) !== "off";
}

export function setCountdownSoundEnabled(enabled: boolean): void {
  writeString(COUNTDOWN_SOUND_KEY, enabled ? null : "off");
}
