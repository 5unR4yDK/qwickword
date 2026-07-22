"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// 2026-07-22, Andreas, interactive: "introduce the toggle top left corner...
// to dark mode so basically I'd say the default is dark mode and then...
// someone who doesn't like dark mode can switch it off." Default-dark itself
// is set server-side (src/app/layout.tsx's <html className="... dark ...">);
// this component is only the switch — flips the `dark` class on <html> and
// remembers the choice in localStorage (no accounts anywhere in this app, so
// this is per-browser, not per-person, consistent with the rest of the app's
// "no login" stance).
const STORAGE_KEY = "qwickword-theme";

export default function ThemeToggle() {
  // Starts unknown (not read from `dark:` classes here), not assumed-dark —
  // the actual theme was already decided before this component ever mounts
  // by the blocking script in layout.tsx's <head> (see that file's comment
  // on why it has to run before paint, not in a React effect). Reading the
  // real DOM state on mount, rather than assuming, is what keeps this
  // component's own icon in sync with whatever that script actually decided
  // (default dark, or a remembered "light" choice) without a hydration
  // mismatch — the button renders no icon at all for the one tick before
  // this effect runs, rather than briefly showing the wrong one.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  // Deferred via a zero-delay setTimeout, same pattern used elsewhere in this
  // app (e.g. call-room.tsx's countdown tick) to stay clear of
  // react-hooks/set-state-in-effect — that rule targets setState calls made
  // unconditionally and synchronously as the effect body runs, not ones
  // deferred into a callback like this.
  useEffect(() => {
    const id = setTimeout(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage unavailable (private browsing, disabled) — the toggle still
      // works for this page view, it just won't be remembered next visit.
    }
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="absolute top-4 left-4 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/[.08] bg-white/70 text-zinc-700 backdrop-blur-sm transition-colors hover:bg-white dark:border-white/[.145] dark:bg-white/[.06] dark:text-zinc-300 dark:hover:bg-white/[.12]"
    >
      {/* Shows the icon for what clicking WOULD switch to, the standard
          convention (a sun while dark, since clicking brings back the
          light; a moon while light) — nothing rendered for the one tick
          before the mount effect above knows the real state. */}
      {isDark === null ? null : isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
