import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const paidOrderSelect = {
  quantity: true,
  amountInPesewas: true,
} satisfies Prisma.OrderSelect;

export type EventWithRevenue = Prisma.EventGetPayload<{
  include: { orders: { select: typeof paidOrderSelect } };
}>;

export type EventForAdmin = Prisma.EventGetPayload<{
  include: {
    orders: { select: { id: true; quantity: true; amountInPesewas: true; status: true } };
  };
}>;

/**
 * The projection every public page renders from. It is an explicit column list
 * rather than a full row so that the customer-facing queries cannot start
 * leaking admin fields (organizerId, createdAt, ...) into a Server Component
 * payload just because a column was added to the model.
 */
const publicEventSelect = {
  id: true,
  slug: true,
  title: true,
  overview: true,
  description: true,
  imageUrl: true,
  venue: true,
  location: true,
  eventDate: true,
  mode: true,
  audience: true,
  agenda: true,
  organizer: true,
  tags: true,
  priceInPesewas: true,
  capacity: true,
  ticketsSold: true,
} satisfies Prisma.EventSelect;

export type PublicEvent = Prisma.EventGetPayload<{ select: typeof publicEventSelect }>;

/**
 * `agenda` and `tags` are Prisma `Json` columns, so the type is `JsonValue` and
 * not `string[]`. Reading them straight into a render would crash the page on a
 * row holding a number or null, so every public read narrows through here.
 */
export function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export async function getAllEvents(): Promise<EventWithRevenue[]> {
  return prisma.event.findMany({
    orderBy: { eventDate: "asc" },
    include: { orders: { where: { status: "PAID" }, select: paidOrderSelect } },
  });
}

export async function getEventBySlug(slug: string): Promise<EventWithRevenue | null> {
  return prisma.event.findUnique({
    where: { slug },
    include: { orders: { where: { status: "PAID" }, select: paidOrderSelect } },
  });
}

export async function getSimilarEvents(eventId: string, tags: string[]): Promise<PublicEvent[]> {
  if (tags.length === 0) return [];

  const wanted = new Set(tags);

  const candidates = await prisma.event.findMany({
    where: { id: { not: eventId }, eventDate: { gte: new Date() } },
    select: { id: true, tags: true },
    orderBy: { eventDate: "asc" },
    take: 50,
  });

  const ranked = candidates
    .map((candidate) => ({
      id: candidate.id,
      score: toStringList(candidate.tags).filter((tag) => wanted.has(tag)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.id);

  if (ranked.length === 0) return [];

  return prisma.event.findMany({
    where: { id: { in: ranked } },
    orderBy: { eventDate: "asc" },
    select: publicEventSelect,
  });
}

export async function getAllEventsForAdmin(): Promise<EventForAdmin[]> {
  return prisma.event.findMany({
    orderBy: { eventDate: "desc" },
    include: {
      orders: { select: { id: true, quantity: true, amountInPesewas: true, status: true } },
    },
  });
}

export function eventStats(event: {
  capacity: number | null;
  orders: { quantity: number; amountInPesewas: number }[];
}) {
  const ticketsSold = event.orders.reduce((sum, order) => sum + order.quantity, 0);
  const revenueInPesewas = event.orders.reduce((sum, order) => sum + order.amountInPesewas, 0);

  return {
    ticketsSold,
    revenueInPesewas,
    capacity: event.capacity,
    remaining: event.capacity == null ? null : Math.max(0, event.capacity - ticketsSold),
    soldOut: event.capacity != null && ticketsSold >= event.capacity,
  };
}

/** Low-stock banner threshold, in tickets, for the public availability counter. */
const LOW_STOCK_THRESHOLD = 10;

export type TicketAvailability = {
  capacity: number | null;
  ticketsSold: number;
  /** `null` when the event has no capacity limit, i.e. it never sells out. */
  remaining: number | null;
  soldOut: boolean;
  unlimited: boolean;
  /** 0-100, used for the progress bar. `0` for an unlimited event. */
  percentSold: number;
  isLowStock: boolean;
};

/**
 * DECISION: the public counter reads `Event.ticketsSold`, not a count of PAID
 * orders. `ticketsSold` is the reservation counter that `createPendingOrder`
 * increments the moment seats are held and `failOrderAndReleaseStock` gives
 * back, and it is the exact figure the oversell guard in `createPendingOrder`
 * compares against. Counting only settled orders would under-report demand and
 * let the counter promise tickets that the server will then refuse to sell.
 * `eventStats` above derives from PAID orders on purpose — it is the revenue
 * report, and only settled money counts there.
 *
 * A count that has drifted past capacity (a lowered capacity, a manual edit)
 * clamps to zero rather than going negative.
 */
export function ticketAvailability(event: {
  capacity: number | null;
  ticketsSold: number;
}): TicketAvailability {
  const ticketsSold = Math.max(0, Math.trunc(event.ticketsSold) || 0);

  if (event.capacity == null) {
    return {
      capacity: null,
      ticketsSold,
      remaining: null,
      soldOut: false,
      unlimited: true,
      percentSold: 0,
      isLowStock: false,
    };
  }

  const capacity = Math.max(0, event.capacity);
  const remaining = Math.max(0, capacity - ticketsSold);

  return {
    capacity,
    ticketsSold,
    remaining,
    soldOut: remaining === 0,
    unlimited: false,
    percentSold: capacity === 0 ? 100 : Math.min(100, (ticketsSold / capacity) * 100),
    isLowStock: remaining > 0 && remaining <= LOW_STOCK_THRESHOLD,
  };
}

/**
 * Upcoming events for the public landing grid. "Upcoming" is evaluated against
 * the database clock on the server, ordered soonest-first, and capped so a
 * long-running event list cannot turn the landing page into an unbounded query.
 */
export async function getUpcomingEvents(limit = 12): Promise<PublicEvent[]> {
  return prisma.event.findMany({
    where: { eventDate: { gte: new Date() } },
    orderBy: { eventDate: "asc" },
    take: limit,
    select: publicEventSelect,
  });
}

export async function getPublicEventById(id: string): Promise<PublicEvent | null> {
  return prisma.event.findUnique({ where: { id }, select: publicEventSelect });
}

/**
 * The live figures the purchase panel needs: the authoritative price, the
 * reservation counters, and whether the event is still in the future. Read
 * separately from the page's own event fetch so the counter can be served from
 * its own Suspense zone and be as fresh as the moment it is rendered.
 *
 * `salesClosed` is derived here rather than in the panel because the clock
 * reading is impure: computing it during render is exactly the kind of unstable
 * value the React Compiler's purity rule rejects. The data layer is already
 * async, so this is where the reading belongs.
 */
export type EventStock = {
  id: string;
  title: string;
  priceInPesewas: number;
  eventDate: Date;
  capacity: number | null;
  ticketsSold: number;
  salesClosed: boolean;
};

export async function getEventStock(eventId: string): Promise<EventStock | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      priceInPesewas: true,
      eventDate: true,
      capacity: true,
      ticketsSold: true,
    },
  });

  if (!event) return null;

  return { ...event, salesClosed: event.eventDate.getTime() <= Date.now() };
}
