import { CheckoutForm } from "@/components/events/checkout-form";
import { TicketAvailabilityCounter } from "@/components/events/ticket-availability-counter";
import { getEventStock, ticketAvailability } from "@/lib/data/events";
import { MAX_TICKETS_PER_ORDER } from "@/lib/validators/payment.schema";

/**
 * The purchase panel is one Suspense zone, not two.
 *
 * The counter and the form have to agree: the form caps its stepper at the
 * stock that the counter displays, and splitting them across two zones would
 * let a buyer see "12 left" beside a stepper that stops at 10, or see a stale
 * stepper next to a fresh number. One query, one zone, one consistent snapshot.
 *
 * It also re-reads the event rather than accepting the page's copy, so the
 * figure is as fresh as the moment the panel streams in.
 */
export async function PurchasePanel({ eventId }: { eventId: string }) {
  const stock = await getEventStock(eventId);

  if (!stock) {
    return null;
  }

  const availability = ticketAvailability(stock);

  // The per-order limit and the remaining stock are both ceilings; the lower one
  // wins.
  const maxQuantity = availability.unlimited
    ? MAX_TICKETS_PER_ORDER
    : Math.min(MAX_TICKETS_PER_ORDER, availability.remaining ?? 0);

  // DECISION: the three states where no ticket can be bought get a message and no
  // form, rather than a form that is pre-disabled.
  //
  // A stepper capped at 0 cannot be operated at all, and for a free event the
  // action has nothing to charge — Paystack's minimum is 1 pesewas, so the
  // submit would be rejected server-side with a message the buyer cannot act on.
  // Hiding the form keeps the reason next to the button that is missing, and
  // stops the page advertising a checkout that cannot complete.
  const isFree = stock.priceInPesewas === 0;
  const soldOut = availability.soldOut;
  const unavailableReason = stock.salesClosed
    ? "Ticket sales for this event have closed."
    : soldOut
      ? "Every ticket for this event has been claimed."
      : null;

  return (
    <div className="bg-card space-y-6 rounded-xl border p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {isFree ? "Free entry" : "Get your tickets"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {isFree
            ? "This event is free to attend. No payment is needed."
            : "Pay by card or mobile money through Paystack."}
        </p>
      </div>

      <TicketAvailabilityCounter
        capacity={availability.capacity}
        ticketsSold={availability.ticketsSold}
        eventTitle={stock.title}
      />

      <div className="border-t pt-6">
        {unavailableReason ? (
          <p className="text-muted-foreground text-sm">{unavailableReason}</p>
        ) : isFree ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Save your place by emailing the organizer directly — there is no online
            checkout for a free event.
          </p>
        ) : (
          <CheckoutForm
            eventId={stock.id}
            unitPriceInPesewas={stock.priceInPesewas}
            maxQuantity={maxQuantity}
          />
        )}
      </div>
    </div>
  );
}
