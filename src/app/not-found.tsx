import InvalidLinkScreen from "@/components/invalid-link-screen";

export default function NotFound() {
  return (
    <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
      <InvalidLinkScreen
        heading="This Qwickword isn't available"
        message="The link may be mistyped, expired, or already finished. Ask for a fresh link, or create one yourself."
      />
    </div>
  );
}
