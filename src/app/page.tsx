import { getDailyConfig } from "@/lib/daily-config";
import CreateLinkForm from "@/components/create-link-form";

export default function Home() {
  const { mockMode } = getDailyConfig();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        {mockMode && (
          <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Mock mode — no Daily API key configured
          </p>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Quick Word
          </h1>
          <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            Set a time limit, share the link. When it hits zero, the call
            ends — there is no extend button.
          </p>
        </div>

        <CreateLinkForm />
      </main>
    </div>
  );
}
