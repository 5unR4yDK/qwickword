import HomeContent from "@/components/home-content";

// v2 call UI preview landing page (CALL_UI_REBUILD_SPEC.md). Andreas,
// interactive, after the first version of this page looked nothing like the
// real home page: "those two pages should be completely identical in both
// functionalities and in UI... everything from creating it to the
// confirmation to all everything." Renders the exact same HomeContent as
// src/app/page.tsx — same Q watermark, same slogan, same create form, same
// success/confirmation screen — with only `basePath="/test"` different, so
// the generated link points at /test/[room] (the new call-object-mode call
// page) instead of /[room] (Daily Prebuilt, unchanged). This route is
// reachable only by typing /test directly — no link to it anywhere a real
// visitor would see.
export const dynamic = "force-dynamic";

export default function TestHome() {
  return <HomeContent basePath="/test" />;
}
