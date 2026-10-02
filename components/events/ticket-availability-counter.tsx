import { Progress } from "@/components/ui/progress";
import { ticketAvailability } from "@/lib/data/events";

/**
 * The explicit ticket availability counter.
 *
 * It renders from the reservation counters that `createPendingOrder` maintains
 * (see `ticketAvailability` for why those and not the settled order count), so
 * the number a buyer reads is the same number the server enforces at checkout.
 */
export function TicketAvailabilityCounter({
  capacity,
  ticketsSold,
  eventTitle,
}: {
  capacity: number | null;
  ticketsSold: number;
  eventTitle: string;
}) {
  const availability = ticketAvailability({ capacity, ticketsSold });

  const headline = availability.unlimited
    ? "Tickets available"
    : availability.soldOut
      ? "Sold out"
      : `${availability.remaining} ticket${availability.remaining === 1 ? "" : "s"} left`;

  const detail = availability.unlimited
    ? "This event has no capacity limit."
    : `${availability.ticketsSold} of ${availability.capacity} claimed`;

  const tone = availability.soldOut
    ? "text-foreground"
    : availability.isLowStock
      ? "text-destructive"
      : "text-success";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Ticket availability</h2>
        <p className={`text-lg font-semibold tabular-nums ${tone}`}>
          <span className="sr-only">{`${eventTitle}: `}</span>
          {headline}
        </p>
      </div>

      {availability.unlimited ? (
        <p className="text-muted-foreground text-sm">Unlimited capacity — buy as many as you need.</p>
      ) : (
        <>
          <Progress
            value={availability.percentSold}
            // Gradient stops, not `bg-*`: the indicator already paints a wine
            // gradient, and a background-colour passed here would sit *under*
            // it instead of replacing it. The wine ramp is the at-rest look; the
            // destructive ramp is reserved for the states that need a warning,
            // which also keeps it legible against a palette that is now itself
            // red.
            indicatorClassName={
              availability.soldOut
                ? "from-destructive to-destructive/70"
                : availability.isLowStock
                  ? "from-destructive to-destructive/70"
                  : "from-brand-accent to-primary"
            }
          />

          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>{detail}</span>
            <span className="tabular-nums">{Math.round(availability.percentSold)}% claimed</span>
          </div>
        </>
      )}
    </div>
  );
}
