import { ArrowRight, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ticketAvailability, type PublicEvent } from "@/lib/data/events";
import { eventDateParts, formatEventDateTime, formatPesewas } from "@/lib/utils";

const MODE_LABEL: Record<PublicEvent["mode"], string> = {
  ONLINE: "Online",
  OFFLINE: "In person",
  HYBRID: "Hybrid",
};

export function EventCard({ event }: { event: PublicEvent }) {
  const { day, month } = eventDateParts(event.eventDate);
  const availability = ticketAvailability(event);

  return (
    // Hover lifts the border rather than the shadow: a drop shadow is black on
    // black here, so it is invisible at rest and does nothing on hover. The
    // wine edge is the affordance that actually reads on a near-black canvas,
    // so it uses the accent step at full strength — a tinted fill would drop the
    // edge to 1.3:1 against the card.
    <article className="bg-card group relative flex h-full w-full flex-col overflow-hidden rounded-xl border transition-colors hover:border-brand-accent focus-within:ring-ring focus-within:ring-[3px]">
      <div className="bg-muted relative aspect-16/10 overflow-hidden">
        <Image
          src={event.imageUrl}
          alt=""
          fill
          unoptimized
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="bg-background/95 flex flex-col items-center rounded-md px-2.5 py-1 leading-none shadow-sm">
            <span className="text-xs font-medium text-pretty uppercase">{month}</span>
            <span className="text-lg font-semibold tabular-nums">{day}</span>
          </div>
          <Badge variant="outline" className="border-brand-accent/40 bg-background/95 text-brand">
            {MODE_LABEL[event.mode]}
          </Badge>
        </div>

        {availability.soldOut && (
          // The scrim is the darkest wine rather than a neutral wash: it puts the card
          // into the palette and, unlike a tint of the accent, it survives being
          // laid over an unpredictable photo. The label keeps its own opaque
          // background so its contrast does not depend on the image.
          <div className="absolute inset-0 grid place-items-center bg-brand-dark/70">
            <span className="rounded-full border bg-background px-3 py-1 text-xs font-semibold">
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="leading-snug font-semibold text-balance">
            {/* The whole card is clickable via this stretched link, so the
                accessible name is the event title and the tap target is the
                card. */}
            <Link href={`/events/${event.id}`} className="after:absolute after:inset-0">
              {event.title}
            </Link>
          </h3>
          {event.overview && (
            <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm text-pretty">
              {event.overview}
            </p>
          )}
        </div>

        <dl className="text-muted-foreground mt-auto space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Starts at</dt>
            <dd className="tabular-nums">{formatEventDateTime(event.eventDate)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Venue</dt>
            <MapPin className="size-4 shrink-0" aria-hidden />
            <dd className="truncate">
              {event.venue}, {event.location}
            </dd>
          </div>
        </dl>

        <div className="flex items-end justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-muted-foreground text-xs">From</p>
            <p className="font-semibold tabular-nums">
              {event.priceInPesewas === 0 ? "Free" : formatPesewas(event.priceInPesewas)}
            </p>
          </div>

          <p
            className={
              availability.soldOut
                ? "text-muted-foreground text-sm font-medium"
                : availability.isLowStock
                  ? "text-destructive text-sm font-medium"
                  : // Same availability tone the purchase panel's counter uses, so
                    // the grid and the detail page never disagree about whether an
                    // event is healthy.
                    "text-success text-sm font-medium"
            }
          >
            {availability.unlimited
              ? "Tickets available"
              : availability.soldOut
                ? "Sold out"
                : `${availability.remaining} left`}
            <ArrowRight
              className="ml-1 inline size-3.5 align-[-0.125em] transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </p>
        </div>
      </div>
    </article>
  );
}
