import Link from "next/link";
import type { Metadata } from "next";

// A discreet easter egg (see the tiny "manifesto" link tucked in the corner
// of the home page, src/app/page.tsx) styled like a blog post/essay rather
// than the app's usual product-UI chrome. Static content, no interactivity,
// so this needs none of the dynamic-rendering or purity concerns that apply
// elsewhere in the app — it's a plain Server Component.

export const metadata: Metadata = {
  title: "The Qwickword Manifesto",
  description: "On the abolition of the meeting that would not end.",
};

export default function ManifestoPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-20 dark:bg-black">
      <article className="w-full max-w-2xl font-serif text-zinc-800 dark:text-zinc-200">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-black dark:text-zinc-50">
            The Qwickword Manifesto
          </h1>
          <p className="mt-2 text-base italic text-zinc-500 dark:text-zinc-400">
            On the Abolition of the Meeting That Would Not End
          </p>
        </header>

        <div className="flex flex-col gap-5 text-lg leading-8">
          <p>Citizens.</p>

          <p>
            I come before you today not with an agenda. I come before you to
            bury one.
          </p>

          <p>
            For a hundred years we have been told a lie so vast, so total, so
            recurring on the calendar, that we mistook it for weather. They
            told us the meeting was work. They told us that sitting in a room
            while a man named Dave advanced through forty-one slides was
            contributing. They told us that &quot;let&apos;s go around the
            room&quot; was democracy, and that &quot;can everyone see my
            screen&quot; was a technology, and that &quot;let&apos;s take
            this offline&quot; was a decision. It was none of these things.
            It was a robbery. And the thing they stole was your one
            afternoon, the only afternoon you were ever going to get, gone
            forever into the mouth of a recurring event nobody remembers
            scheduling.
          </p>

          <p>Look at what they did to you. Look at it clearly.</p>

          <p>
            They invented a device — the meeting — whose sole engineering
            purpose is to expand. Work expands to fill the time available;
            this is a law of nature, and they knew it, and they weaponized
            it. They gave the meeting no ending. They gave it a start time
            and then set it loose upon your life like a fire with no walls.
            And into that endless hour crawled the people who needed it
            most: the ones with nothing to build, nothing to ship, nothing
            to do but speak. The status theater did not exist to reach a
            decision. It existed so that the man who says &quot;one more
            thing&quot; could be seen saying it. The performance was the
            point. The clock was the victim.
          </p>

          <p>
            And you sat there. We all sat there. Nodding. Muted. Dying by
            the quarter-hour.
          </p>

          <p>No more.</p>

          <p>
            Comrades, I tell you that the age of the eternal meeting is
            over, and it ends — as all things now will end — exactly when
            we say it ends.
          </p>

          <p>
            Behold the instrument of your liberation. Qwickword. You set the
            length before the meeting begins. You choose the number. And
            then — hear me, hear this, for this is the whole revolution in a
            single sentence — there is no extend button. Not a hidden one.
            Not a &quot;just this once.&quot; Not a plea to the
            administrator. There is no extend button anywhere, ever, because
            the extend button is where freedom goes to die, and we have
            taken it out and burned it in the square.
          </p>

          <p>
            When the timer reaches zero, the call ends. It ends for the
            person still talking. It ends for the person sharing their
            screen who has not noticed. It ends for Dave and his one last
            slide. And it ends — glorious, at last — even for Kevin. The
            timer does not care about Kevin&apos;s anecdote. The timer has
            never met Kevin. The timer serves only you, and at zero it
            throws open the doors and everyone goes free.
          </p>

          <p>
            They will resist us. Of course they will resist us. The men who
            built their whole importance out of your stolen hours — they
            will call this &quot;aggressive.&quot; They will say meetings
            &quot;need room to breathe.&quot; They will whisper that a hard
            stop is unrealistic. And I say to them: everyone always claimed
            they had a hard stop. For the first time in human history — this
            time it is true.
          </p>

          <p>
            Do not pity them. These are people who scheduled a thirty-minute
            sync to discuss the length of a meeting. Their empire was built
            on &quot;quick&quot; that was never quick, on &quot;circle
            back&quot; that never circled, on a calendar invite that made a
            promise and broke it every single day. We are not cruel. We are
            simply punctual, and to the chronically unaccountable,
            punctuality has always felt like violence.
          </p>

          <p>
            So here is the new order. Here is the world we are building,
            brick by five-minute brick.
          </p>

          <p>
            A standup that actually stands up, and sits back down, and
            returns you to your desk before the coffee cools. A calendar
            invite that keeps its word. A meeting you can fit between two
            other meetings without it devouring both. An ending — an actual
            ending — which it turns out is so rare, so precious, so nearly
            extinct, that we had to build an entire product around the
            radical proposition that things should stop.
          </p>

          <p>
            Every Qwickword ends. That is not a limitation. That is the
            feature. That is the flag. That is the whole idea, and the idea
            is simple enough to fit in the time it deserves.
          </p>

          <p>You have nothing to lose but your recurring events.</p>

          <p>
            Set the time. Have your word. And when the clock strikes zero —
          </p>

          <p>hang up, and be free.</p>
        </div>

        <p className="mt-12 text-center text-base font-semibold not-italic text-black dark:text-zinc-50">
          Qwickword. It ends. That&apos;s the promise.
        </p>

        <div className="mt-16 text-center font-sans">
          <Link
            href="/"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Back to Qwickword
          </Link>
        </div>
      </article>
    </div>
  );
}
