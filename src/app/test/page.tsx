import Link from "next/link";
import TestCreateForm from "@/components/call-v2/test-create-form";

// v2 call UI preview entry point (CALL_UI_REBUILD_SPEC.md). Andreas,
// interactive: "Can we build this in parallel to the existing quick word
// just under a folder like '/test' Just to see what it looks like before we
// start overriding the current view." Deliberately unlinked from the
// production home page (src/app/page.tsx) — reachable only by typing
// /test, not from any nav a real visitor would see.

export default function TestHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-6 py-24 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Qwickword — v2 call UI preview</h1>
        <p className="max-w-md text-sm text-zinc-400">
          Daily call-object mode, styled like Google Meet — full-bleed video, a
          floating control pill, branding as an overlay instead of a banner.
          Pick a length to create a real (short) test call and see it live.
        </p>
      </div>
      <TestCreateForm />
      <Link href="/" className="text-xs text-zinc-600 underline underline-offset-4 hover:text-zinc-400">
        Back to the real Qwickword
      </Link>
    </div>
  );
}
