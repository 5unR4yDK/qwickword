import InvalidLinkScreen from "@/components/invalid-link-screen";

export default function RoomNotFound() {
  return (
    <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden overscroll-none bg-black">
      <InvalidLinkScreen
        heading="This room is closed"
        message="It was retired, or it went unused for long enough to expire. Ask for a fresh link, or create a Qwickword of your own."
      />
    </div>
  );
}
