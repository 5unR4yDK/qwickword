import { getDailyConfig } from "@/lib/daily-config";
import CreateLinkForm from "@/components/create-link-form";
import ThemeToggle from "@/components/theme-toggle";
import SettingsMenu from "@/components/settings-menu";

/**
 * The home page shell: background, ambient glow, and the two corner
 * controls. The centred column itself (wordmark, tagline, picker, and the
 * link-created state) lives in CreateLinkForm, because creating a link
 * reshapes that whole column, not just the form controls.
 */
export default function HomeContent() {
  const { mockMode } = getDailyConfig();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      <ThemeToggle />
      <SettingsMenu />

      {/* Ambient cyan glow — background layer only, never on text or
          controls. One oversized, heavily blurred radial that fades out
          well before its own edge so no boundary reads as a shape.
          mix-blend-screen makes it a no-op on the light theme's white
          background. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,254,241,0.11)_0%,rgba(61,254,241,0.03)_38%,transparent_70%)] blur-[64px] mix-blend-screen" />
      </div>

      <main className="relative z-10 flex w-full flex-col items-center">
        <CreateLinkForm mockMode={mockMode} />
      </main>
    </div>
  );
}
