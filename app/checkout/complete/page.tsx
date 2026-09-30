import type { Metadata } from "next";
import {
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  CircleX,
  LoaderCircle,
  MapPin,
  Receipt,
  Ticket as TicketIcon,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { OrderStatusPoller } from "@/components/checkout/order-status-poller";
import { TicketQr } from "@/components/checkout/ticket-qr";
import { SiteFooter } from "@/components/events/site-footer";
import { SiteHeader } from "@/components/events/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderConfirmation } from "@/lib/data/orders";
import { getOrderConfirmation } from "@/lib/data/orders";
import { referenceFromSearchParams } from "@/lib/validators/order.schema";
import { formatEventDateTime, formatPesewas } from "@/lib/utils";

/**
 * DECISION: never statically rendered, and never cached.
 *
 * The URL carries the transaction reference, which is the only credential the
 * buyer has — checkout is a guest flow, so there is no session to gate on. A
 * prerendered or cached copy of this page would put an order's tickets into a
 * shared cache. `force-dynamic` keeps the Prisma read on the request path so the
 * page reflects the webhook the moment it lands, which is also what makes the
 * poller's `router.refresh()` meaningful.
 */
export const dynamic = "force-dynamic";

const MODE_LABEL = {
  ONLINE: "Online",
  OFFLINE: "In person",
  HYBRID: "Hybrid",
} as const;

/**
 * The reference in the URL is a bearer credential for a set of admission tickets,
 * so this page must never be indexed or cached. `noindex` keeps it out of search
 * results and `nocache` tells crawlers not to keep a copy. The `no-referrer`
 * policy that keeps the reference out of the Referer header is set as an HTTP
 * header in next.config.ts, which takes precedence over any meta tag here.
 */
export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false, nocache: true },
};

export default async function CheckoutCompletePage({
  searchParams,
}: PageProps<"/checkout/complete">) {
  const params = await searchParams;
  const reference = referenceFromSearchParams(params);

  if (!reference) {
    // No usable reference. This is what a bookmark, a mistyped link, or a
    // stripped query string produces, and it must not throw — the visitor gets a
    // way back to the events rather than an error page.
    return (
      <PageShell>
        <Card className="mx-auto w-full max-w-xl">
          <CardHeader>
            <div className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
              <CircleAlert aria-hidden />
            </div>
            <CardTitle>We could not find your order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm text-pretty">
              This page needs the payment reference from your checkout, and the link you opened does
              not have a valid one. If you have just paid, your receipt email is the authoritative
              record — it carries your tickets.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="sm:w-auto">
                <Link href="/#events">Browse events</Link>
              </Button>
              <Button asChild variant="outline" className="sm:w-auto">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const order = await getOrderConfirmation(reference);

  if (!order) {
    // An unknown reference is logged rather than ignored: legitimate redirects
    // cannot produce one, so a spike here means someone is probing. The copy
    // stays identical to the malformed-reference case so this endpoint does not
    // become an oracle for testing whether a guessed reference exists.
    console.warn("Checkout completion requested for an unknown reference", { reference });

    return (
      <PageShell>
        <Card className="mx-auto w-full max-w-xl">
          <CardHeader>
            <div className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
              <CircleAlert aria-hidden />
            </div>
            <CardTitle>We could not find your order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm text-pretty">
              No order matches this payment reference. If you have just paid, give it a few seconds
              and reload — and check your inbox, as the organizer&apos;s confirmation email carries
              your tickets either way.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="sm:w-auto">
                <Link href="/#events">Browse events</Link>
              </Button>
              <Button asChild variant="outline" className="sm:w-auto">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <StatusHeader order={order} />
        <OrderSummary order={order} />

        {order.status === "PAID" ? (
          <TicketSection order={order} />
        ) : order.status === "PENDING" ? (
          <Card>
            <CardContent className="pt-6">
              <OrderStatusPoller />
            </CardContent>
          </Card>
        ) : (
          <FailureNotice order={order} />
        )}
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// shell
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

function StatusHeader({ order }: { order: OrderConfirmation }) {
  const paid = order.status === "PAID";

  return (
    <div className="text-center">
      <div
        className={
          paid
            ? "bg-success/10 text-success mx-auto grid size-14 place-items-center rounded-full"
            : "bg-muted text-muted-foreground mx-auto grid size-14 place-items-center rounded-full"
        }
      >
        {paid ? <BadgeCheck aria-hidden /> : <LoaderCircle aria-hidden />}
      </div>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {paid ? "Your tickets are ready" : "Payment received"}
      </h1>

      <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-pretty">
        {paid
          ? `A confirmation is on its way to ${order.email}. Keep the QR code below — it is scanned once, at the door.`
          : "We are waiting for the payment provider to confirm this transaction."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

function OrderSummary({ order }: { order: OrderConfirmation }) {
  const { event } = order;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" aria-hidden />
            Order summary
          </CardTitle>
          <OrderStatusBadge status={order.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="bg-muted relative aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:aspect-square sm:w-28">
            <Image src={event.imageUrl} alt="" fill unoptimized className="object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-pretty">{event.title}</h3>
            <Badge variant="outline" className="mt-2">
              {MODE_LABEL[event.mode]}
            </Badge>

            <dl className="text-muted-foreground mt-3 space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <dt className="shrink-0">
                  <CalendarClock className="size-4 translate-y-px" aria-hidden />
                  <span className="sr-only">When</span>
                </dt>
                <dd>{formatEventDateTime(event.eventDate)}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="shrink-0">
                  <MapPin className="size-4 translate-y-px" aria-hidden />
                  <span className="sr-only">Where</span>
                </dt>
                <dd className="text-pretty">
                  {event.venue}, {event.location}
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="shrink-0">
                  <UserRound className="size-4 translate-y-px" aria-hidden />
                  <span className="sr-only">Booked by</span>
                </dt>
                <dd className="text-pretty">
                  {order.fullName}
                  <span className="text-muted-foreground/70"> · {order.email}</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="bg-muted/60 space-y-2 rounded-lg p-4 text-sm">
          <Row label="Order ID">
            <code className="font-mono text-xs">{order.id}</code>
          </Row>
          <Row label="Payment reference">
            <code className="font-mono text-xs">{order.paystackReference}</code>
          </Row>
          <Row label="Tickets">
            <span className="tabular-nums">
              {order.quantity} × {formatPesewas(Math.round(order.amountInPesewas / order.quantity))}
            </span>
          </Row>
          <div className="border-muted-foreground/20 flex items-baseline justify-between border-t pt-2">
            <span className="font-medium">Total paid</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatPesewas(order.amountInPesewas)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: OrderConfirmation["status"] }) {
  if (status === "PAID") {
    return (
      <Badge className="bg-success text-success-foreground gap-1">
        <BadgeCheck aria-hidden />
        Paid
      </Badge>
    );
  }

  if (status === "PENDING") {
    return (
      <Badge variant="secondary" className="gap-1">
        <LoaderCircle className="animate-spin" aria-hidden />
        Pending
      </Badge>
    );
  }

  if (status === "REFUNDED") {
    return <Badge variant="secondary">Refunded</Badge>;
  }

  return (
    <Badge variant="destructive" className="gap-1">
      <CircleX aria-hidden />
      Failed
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// tickets
// ---------------------------------------------------------------------------

function TicketSection({ order }: { order: OrderConfirmation }) {
  // A PAID order always has tickets: markOrderPaidAndIssueTickets mints them in
  // the same transaction that sets the status. An empty list therefore means the
  // row was touched outside the settlement path, and the honest thing to say is
  // that we cannot show a code yet — not to render an empty grid that looks like
  // a bug.
  if (order.tickets.length === 0) {
    return (
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertTitle>Tickets are being generated</AlertTitle>
        <AlertDescription>
          This order is paid, but no ticket codes are attached to it yet. Reload in a moment — if it
          persists, contact the organizer and quote order {order.id}.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <TicketIcon className="size-4" aria-hidden />
          {order.tickets.length === 1 ? "Your ticket" : `Your ${order.tickets.length} tickets`}
        </h2>
        <p className="text-muted-foreground text-xs">One code per ticket · single use</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {order.tickets.map((ticket, index) => (
          <li key={ticket.id}>
            <Card
              className={
                ticket.status === "ISSUED"
                  ? "h-full"
                  : "border-dashed opacity-90 h-full"
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">
                    {order.tickets.length === 1 ? "Ticket" : `Ticket ${index + 1}`}
                  </CardTitle>
                  <TicketStatusBadge status={ticket.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {ticket.status === "ISSUED" ? (
                  <>
                    <TicketQr token={ticket.qrCodeToken} />
                    <p className="text-muted-foreground text-center text-xs text-pretty">
                      Turn your screen brightness up and hold the phone about 20&nbsp;cm from the
                      scanner.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground py-6 text-center text-sm text-pretty">
                    This code is not valid for entry
                    {ticket.status === "USED" && ticket.usedAt
                      ? ` — it was already scanned on ${formatEventDateTime(ticket.usedAt)}.`
                      : "."}
                  </p>
                )}

                {/* The token is also rendered as text. A code that will not scan
                    because of a dim screen, a cracked protector or a camera that
                    will not focus still admits its holder, because gate staff can
                    type it in. */}
                <div className="bg-muted/60 rounded-md p-3 text-center">
                  <p className="text-muted-foreground text-[0.65rem] tracking-wide uppercase">
                    Ticket reference
                  </p>
                  <code className="mt-1 block font-mono text-xs break-all">{ticket.qrCodeToken}</code>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TicketStatusBadge({ status }: { status: OrderConfirmation["tickets"][number]["status"] }) {
  if (status === "ISSUED") {
    return (
      <Badge className="bg-success text-success-foreground gap-1">
        <BadgeCheck aria-hidden />
        Valid
      </Badge>
    );
  }

  if (status === "USED") return <Badge variant="secondary">Scanned</Badge>;

  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge variant="outline">{label}</Badge>;
}

// ---------------------------------------------------------------------------
// failure
// ---------------------------------------------------------------------------

function FailureNotice({ order }: { order: OrderConfirmation }) {
  const refunded = order.status === "REFUNDED";

  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>
        {refunded ? "This order was refunded" : "This payment did not go through"}
      </AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="text-pretty">
          {refunded
            ? "The organizer returned this payment, so the seats it held have been released and the tickets are no longer valid."
            : "No tickets were issued and the seats this order was holding have been released back to the event. You have not been charged."}
        </p>

        {/* Retrying means re-entering the Paystack checkout, which is only
            possible against the event page. A dead-end message would leave the
            buyer to hunt for it. */}
        <Button asChild size="sm" variant="outline">
          <Link href={`/events/${order.event.id}`}>
            Try again for {order.event.title}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
