import { MapPin } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSimilarEvents, toStringList, ticketAvailability } from "@/lib/data/events";
import { eventDateParts, formatPesewas } from "@/lib/utils";

/**
 * The second dynamic zone on the event page. It is ranked by tag overlap, so it
 * is a genuinely different query from the panel's and worth streaming
 * independently: a slow or empty result never delays the purchase panel.
 */
export async function RelatedEvents({ eventId, tags }: { eventId: string; tags: string[] }) {
  const related = await getSimilarEvents(eventId, tags);

  if (related.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing else is on sale with these tags right now.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {related.map((event) => {
        const { day, month } = eventDateParts(event.eventDate);
        const availability = ticketAvailability(event);
        const lead = toStringList(event.tags)[0];

        return (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className="hover:bg-accent/50 flex h-full items-start gap-4 rounded-lg border p-4 transition-colors"
            >
              <div className="bg-muted flex size-12 shrink-0 flex-col items-center justify-center rounded-md leading-none">
                <span className="text-[0.65rem] font-medium uppercase">{month}</span>
                <span className="text-base font-semibold tabular-nums">{day}</span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{event.title}</h3>
                <p className="text-muted-foreground mt-1 flex items-center gap-1.5 truncate text-xs">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {event.venue}, {event.location}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {event.priceInPesewas === 0 ? "Free" : formatPesewas(event.priceInPesewas)}
                  </span>
                  {lead && (
                    <Badge variant="secondary" className="max-w-28 truncate">
                      {lead}
                    </Badge>
                  )}
                  {availability.soldOut ? (
                    <span className="text-muted-foreground ml-auto text-xs">Sold out</span>
                  ) : !availability.unlimited ? (
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      {availability.remaining} left
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RelatedEventsSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: 2 }, (_, index) => (
        <li key={index} className="flex items-start gap-4 rounded-lg border p-4">
          <Skeleton className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
