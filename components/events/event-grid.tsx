import { CalendarDays } from "lucide-react";

import { EventCard } from "@/components/events/event-card";
import { getUpcomingEvents } from "@/lib/data/events";

/**
 * The landing page's dynamic zone. This is an `async` Server Component, so the
 * SQLite query runs on the server and only the rendered cards cross the wire as
 * HTML — no client fetch, no loading spinner in the JS bundle. The page wraps it
 * in `<Suspense>`, which is what makes the shell paint immediately.
 */
export async function EventGrid() {
  const events = await getUpcomingEvents();

  if (events.length === 0) {
    return (
      <div className="border-dashed text-muted-foreground flex flex-col items-center gap-3 rounded-xl border px-6 py-16 text-center">
        <CalendarDays className="size-8" aria-hidden />
        <p className="text-foreground font-medium">No events are on sale yet</p>
        <p className="max-w-sm text-sm text-pretty">
          New dates are announced as organizers publish them. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <li key={event.id} className="flex">
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}
