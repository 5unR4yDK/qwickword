import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Used only for the large decorative "Q" watermark on the home page
// (src/app/page.tsx) — a distinctive serif with an elegant, long-tailed Q,
// not for body text. Andreas asked for something "same font type as Times
// New Roman or similar, maybe more unique" — Playfair Display is a serif in
// that family with a more sculpted, editorial letterform than Times.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["700"],
});

// SEO + AI-search discoverability pass (2026-07-22, Andreas, interactive:
// "Can you do SEO optimization of the site and also AI search optimization
// so AIs will find it"). metadataBase turns every relative URL in this
// file's metadata (and any page's) into an absolute one automatically —
// required for openGraph/twitter image URLs and canonical links to resolve
// correctly regardless of which domain/preview URL served the request.
// keywords/openGraph/twitter cover traditional search + link-preview
// surfaces (Slack, iMessage, Twitter/X); robots is explicit (rather than
// relying on the default-allow behavior) so it's unambiguous both to search
// crawlers and to AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc., which
// mostly respect the same generic `robots` meta / robots.txt conventions —
// see src/app/robots.ts and public/llms.txt for the rest of this pass).
export const metadata: Metadata = {
  metadataBase: new URL("https://qwickword.com"),
  title: {
    default: "Qwickword — video calls that end on time",
    template: "%s — Qwickword",
  },
  description:
    "Set a time limit, share the link, start talking. No account, no download — the call ends the moment the timer hits zero, so it never runs long.",
  keywords: [
    "time-limited video call",
    "self-destructing video call link",
    "video call timer",
    "short meeting tool",
    "no-signup video call",
    "Daily.co video call app",
  ],
  authors: [{ name: "Qwickword" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: "https://qwickword.com",
    siteName: "Qwickword",
    title: "Qwickword — video calls that end on time",
    description:
      "Set a time limit, share the link, start talking. No account, no download — the call ends the moment the timer hits zero.",
  },
  twitter: {
    card: "summary",
    title: "Qwickword — video calls that end on time",
    description:
      "Set a time limit, share the link, start talking. No account, no download — the call ends the moment the timer hits zero.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Defaults to dark (2026-07-22, Andreas, interactive: "the default is
      // dark mode and then... someone who doesn't like dark mode can switch
      // it off"). The `dark` class here is what src/app/globals.css's
      // `@custom-variant dark` now keys every `dark:` utility off of.
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} dark h-full antialiased`}
    >
      <head>
        {/* Blocking (no defer/async), runs before first paint — the
            standard fix for the "flash of wrong theme" problem: without
            this, a visitor who'd previously chosen light mode would see a
            flash of dark (the server-rendered default above) before
            src/components/theme-toggle.tsx's own React effect ever runs.
            Only ever REMOVES the dark class (when localStorage explicitly
            says "light") — if unset, or set to "dark", or reading
            localStorage throws (private browsing, disabled storage), it's a
            silent no-op and the server-rendered dark default just stands,
            which is the correct fallback either way. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('qwickword-theme')==='light'){document.documentElement.classList.remove('dark');}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Vercel Web Analytics (2026-07-22, Andreas, interactive: "I would
            like to be able to follow this in the future to see if people
            are using the tool or at least that they're coming to the site
            or not"). Cookieless page-view/visitor tracking — no consent
            banner needed. Renders nothing visible; injects a small script
            that reports to Vercel's dashboard for this project. */}
        <Analytics />
      </body>
    </html>
  );
}
