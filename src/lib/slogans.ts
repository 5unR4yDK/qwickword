// Rotating tagline shown under the "Qwickword" wordmark on the home page.
// The full working list, review notes, and what got cut/why live in
// SLOGANS.md — this file is just the deploy-ready array Andreas approved
// ("deploy all the slogans, have them land at random") after the second
// review pass on 2026-07-21.
//
// `pickRandomSlogan()` is a plain named function rather than an inline
// `Math.random()` call in a Server Component's render body, for the same
// reason `Date.now()` was moved into its own function in src/lib/time.ts:
// `react-hooks/purity` (bundled via eslint-config-next) rejects calling an
// impure function directly during render, even for a Server Component doing
// legitimate per-request work. See src/app/page.tsx for the caller — it also
// needs `export const dynamic = "force-dynamic"`, otherwise Next.js would
// pick one random line at build time and freeze it for every visitor.

export const SLOGANS: readonly string[] = [
  // Core positioning
  "Set a time. Have the word. Hang up.",
  "The meeting that isn't allowed to run long.",
  "Every Qwickword ends. That's the whole idea.",
  "No extend button. Anywhere. Ever.",
  "It ends. That's the feature.",
  "A meeting with an ejector seat.",

  // Meeting culture
  "This meeting could have been a Qwickword.",
  '"Just five more minutes" has never once been five minutes.',
  "Somewhere right now, a meeting that should've ended an hour ago is still going. Not this one.",
  "A calendar invite that keeps its promise.",
  "Everyone claims they have a hard stop. This time it's true.",
  'Ends before anyone can say "let\'s go around the room."',
  "The call ends even if the person sharing their screen doesn't notice.",
  '"One last thing" — not on this call you don\'t.',
  "Your 2 o'clock can't eat your 3 o'clock if it's dead by 2:05.",
  'Zero minutes budgeted for "can everyone see my screen?" Spend wisely.',
  "When the timer hits zero, everyone goes free. Even Kevin.",

  // Developers & creators
  "The standup that doesn't turn into a design review.",
  "A standup short enough to actually stand up for.",
  "Shorter than your last sprint retro. Much shorter.",
  "Ten minutes, tops — the PR isn't going to review itself.",
  "Your calendar already has enough recurring events.",
  "Parkinson's Law, repealed.",
  "Work expands to fill the time available. So we took the time away.",

  // For the person running the team
  "Trust, but time-box.",
  "Know your team's back at their desks in five.",
  "The meeting you can actually fit between two other meetings.",
  "Give people their afternoon back.",
  "The countdown doesn't care that Dave has one more slide.",
  "Back-to-backs, except each one actually ends.",

  // Longer lines
  "Every other tool brags about no time limit. We brag about the opposite.",
  "The call ends at zero, not whenever everyone finally stops talking.",
  "You'd be surprised how many good ideas fit in three minutes, once you're forced to find out.",
  "Most meetings don't need an hour. Most don't need thirty minutes. Try five.",
  "A video call with an ending. Apparently that's rare enough to build a product on.",
] as const;

export function pickRandomSlogan(): string {
  return SLOGANS[Math.floor(Math.random() * SLOGANS.length)];
}
