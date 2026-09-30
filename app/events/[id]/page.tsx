import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarClock, MapPin, Ticket, UserRound, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PurchasePanel } from "@/components/events/purchase-panel";
import { PurchasePanelSkeleton } from "@/components/events/purchase-panel-skeleton";
import { RelatedEvents, RelatedEventsSkeleton } from "@/components/events/related-events";
import { SiteFooter } from "@/components/events/site-footer";
import { SiteHeader } from "@/components/events/site-header";
import { Badge } from "@/components/ui/badge";
import { getPublicEventById, toStringList } from "@/lib/data/events";
import { formatEventDateTime, formatPesewas } from "@/lib/utils";

const MODE_LABEL = {
  ONLINE: "Online",
  OFFLINE: "In person",
  HYBRID: "Hybrid",
} as const;

export async function generateMetadata(
  props: PageProps<"/events/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const event = await getPublicEventById(id);

  if (!event) {
    return { title: "Event not found" };
  }

  return {
    title: `${event.title} — EventHub`,
    description: event.overview || event.description || undefined,
    openGraph: {
      title: event.title,
      description: event.overview || event.description || undefined,
      images: [{ url: event.imageUrl }],
      type: "website",
    },
  };
}

export default async function EventDetailsPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;

  // Resolved before any Suspense boundary below. The status code is written when
  // this await settles, so an unknown id is a real 404 rather than a 200 with a
  // not-found message streamed into the body — which is what would happen if the
  // lookup lived inside a boundary.
  const event = await getPublicEventById(id);

  if (!event) {
    notFound();
  }

  const agenda = toStringList(event.agenda);
  const tags = toStringList(event.tags);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="border-b">
          <div className="bg-muted relative aspect-21/9 w-full overflow-hidden sm:aspect-32/7">
            <Image src={event.imageUrl} alt="" fill priority unoptimized className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>

          <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10 sm:px-6">
            <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
              <Link href="/#events" className="hover:text-foreground transition-colors">
                ← All events
              </Link>
            </nav>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{MODE_LABEL[event.mode]}</Badge>
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {event.title}
            </h1>

            {event.overview && (
              <p className="text-muted-foreground mt-4 max-w-3xl text-lg text-pretty">
                {event.overview}
              </p>
            )}

            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact icon={CalendarClock} label="When" value={formatEventDateTime(event.eventDate)} />
              <Fact icon={MapPin} label="Where" value={`${event.venue}, ${event.location}`} />
              <Fact
                icon={Users}
                label="Audience"
                value={event.audience || "Open to all"}
              />
              <Fact
                icon={Ticket}
                label="Price"
                value={event.priceInPesewas === 0 ? "Free" : formatPesewas(event.priceInPesewas)}
              />
            </dl>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Static content. Rendered from the page's own fetch with no
                further await, so it is part of the shell and needs no boundary. */}
            <div className="space-y-10">
              {event.description && (
                <section>
                  <h2 className="text-xl font-semibold tracking-tight">About this event</h2>
                  <div className="text-muted-foreground mt-3 space-y-4 leading-relaxed">
                    {event.description.split("\n").filter(Boolean).map((paragraph, index) => (
                      <p key={index} className="text-pretty">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              {agenda.length > 0 && (
                <section>
                  <h2 className="text-xl font-semibold tracking-tight">What to expect</h2>
                  <ol className="mt-4 space-y-3">
                    {agenda.map((item, index) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums">
                          {index + 1}
                        </span>
                        <span className="text-pretty">{item}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section>
                <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                  <UserRound className="size-5" aria-hidden />
                  Organizer
                </h2>
                <p className="mt-3">{event.organizer}</p>
              </section>

              {/* Second dynamic zone: tag-ranked recommendations, ranked by a
                  query unrelated to the one behind the panel. */}
              <section>
                <h2 className="text-xl font-semibold tracking-tight">You might also like</h2>
                <div className="mt-4">
                  <Suspense fallback={<RelatedEventsSkeleton />}>
                    <RelatedEvents eventId={event.id} tags={tags} />
                  </Suspense>
                </div>
              </section>
            </div>

            {/* First dynamic zone: the availability counter and the checkout
                form, sharing one fresh stock read. */}
            <aside className="lg:sticky lg:top-24">
              <Suspense fallback={<PurchasePanelSkeleton />}>
                <PurchasePanel eventId={event.id} />
              </Suspense>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="text-sm font-medium text-pretty">{value}</dd>
      </div>
    </div>
  );
}
