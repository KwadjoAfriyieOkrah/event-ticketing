import { Suspense } from "react";
import { ScanLine, ShieldCheck, Ticket } from "lucide-react";

import { EventGrid } from "@/components/events/event-grid";
import { EventGridSkeleton } from "@/components/events/event-grid-skeleton";
import { Hero } from "@/components/events/hero";
import { SiteFooter } from "@/components/events/site-footer";
import { SiteHeader } from "@/components/events/site-header";

const STEPS = [
  {
    icon: Ticket,
    title: "Pick your event",
    body: "Every listing shows the live ticket count, so you can see what is left before you commit.",
  },
  {
    icon: ShieldCheck,
    title: "Pay with Paystack",
    body: "Card or mobile money. The amount is calculated on the server from the event price.",
  },
  {
    icon: ScanLine,
    title: "Scan at the gate",
    body: "A single-use QR code is issued to your email and admits you once.",
  },
];

/**
 * DECISION: render this route per request rather than prerendering it.
 *
 * Next only knows a route is dynamic from request-time APIs (cookies, headers,
 * searchParams) and uncached `fetch`. A direct Prisma query is invisible to that
 * analysis, so without this the build prerenders the grid and bakes the event
 * list — including the availability numbers — in at deploy time, and a newly
 * published event does not appear until the next build. The flag costs one
 * SQLite read per request and keeps the grid's own Suspense zone streaming, so
 * the shell still paints first.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <Hero />

        {/* The one dynamic zone on this page. The header, hero and section
            chrome are static and stream first; only the grid waits on SQLite,
            so the visitor sees the whole page frame immediately and the cards
            fill in when the query resolves. */}
        <section id="events" className="scroll-mt-16 border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Upcoming events
                </h2>
                <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                  Soonest first. Availability updates as tickets are bought.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <Suspense fallback={<EventGridSkeleton />}>
                <EventGrid />
              </Suspense>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>

            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-brand grid size-9 shrink-0 place-items-center rounded-md">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-muted-foreground text-sm font-medium tabular-nums">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground text-sm text-pretty">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
