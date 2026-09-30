/**
 * Database seed for local development and cold-boot demo data.
 *
 * DESTRUCTIVE: every row in Ticket, Order, Event and User is deleted before the
 * fixtures are written. Never point this at a database you care about.
 *
 * Event fixtures are deliberately run through the same Zod schema the admin UI
 * writes with (`eventWriteSchema`), so seeded events cannot drift outside the
 * bounds the app enforces on real organizer input.
 *
 * Two counters in this schema are easy to get wrong, so the fixtures respect the
 * same invariants as `lib/orders.ts`:
 *
 *   1. `Event.ticketsSold` is a *reservation* counter. `createPendingOrder`
 *      increments it the moment seats are held, and only a FAILED order gives
 *      them back, so it counts PENDING + PAID seats and never PAID alone.
 *   2. Tickets are minted at settlement, not at checkout. A PENDING order has no
 *      tickets at all; a PAID order has one ISSUED ticket per unit.
 */

import "dotenv/config";

import { randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import type { EventMode } from "@prisma/client";
import bcrypt from "bcryptjs";

import { generateQrCodeToken } from "@/lib/tokens";
import { eventWriteSchema } from "@/lib/validators/event.schema";
import { MAX_TICKETS_PER_ORDER } from "@/lib/validators/payment.schema";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

/** Fixed PRNG seed, so re-running produces the same fixtures every time. */
const FIXTURE_SEED = 0x9e3779b9;

const DEV_ADMIN_EMAIL = "admin@eventticketing.test";
const DEV_ADMIN_PASSWORD = "Admin!Accra2026";
const DEV_ORGANIZER_EMAIL = "organizer@eventticketing.test";
const DEV_ORGANIZER_PASSWORD = "Organize!Kumasi2026";
const DEV_BUYER_PASSWORD = "Buyer!Accra2026";

const ORGANIZER_NAME = "Ama Owusu";
const ORGANIZER_ORG = "Sankofa Live Events";

/* -------------------------------------------------------------- fixtures */

type EventFixture = {
  title: string;
  slug: string;
  venue: string;
  location: string;
  mode: EventMode;
  audience: string;
  organizer: string;
  description: string;
  overview: string;
  imageUrl: string;
  agenda: string[];
  tags: string[];
  priceInPesewas: number;
  capacity: number | null;
  /** Days from seed time. Relative, so fixtures never age into the past. */
  inDays: number;
  /** Start hour in Accra time (GMT+0), 24h clock. */
  startHourUtc: number;
  /** Seats held by settled orders, then by orders still awaiting payment. */
  demand: { paid: number; pending: number };
};

const EVENT_FIXTURES: EventFixture[] = [
  {
    title: "Accra Tech Summit 2026",
    slug: "accra-tech-summit-2026",
    venue: "Accra International Conference Centre",
    location: "Independence Ave, Accra",
    mode: "OFFLINE",
    audience: "Engineers, founders, investors and policymakers",
    organizer: "Ghana Digital Founders",
    overview:
      "Ghana's largest gathering of builders shipping real products: two days of talks, an expo hall and a startup pitch finals block.",
    description:
      "The Accra Tech Summit brings together the engineers, founders and investors building the next generation of African software. Day one covers platform infrastructure, payments and machine learning in production, with lightning talks from teams shipping at scale across Accra, Kumasi and Takoradi. Day two is the expo hall and the pitch finals, where early-stage founders demo to a panel of Ghanaian venture funds.\n\nEvery ticket includes lunch, filtered coffee throughout the day, and access to the recorded talk library for twelve months after the event.",
    imageUrl:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
    agenda: [
      "08:00 - Registration, badge collection and breakfast",
      "09:30 - Opening keynote: building for the next ten million Africans online",
      "11:00 - Payments infrastructure panel with the Bank of Ghana fintech team",
      "14:00 - Expo hall opens, 40 booths across two halls",
      "16:30 - Startup pitch finals, eight founders, five minutes each",
    ],
    tags: ["technology", "conference", "accra", "ai", "startups"],
    priceInPesewas: 35000,
    capacity: 1200,
    inDays: 12,
    startHourUtc: 8,
    demand: { paid: 611, pending: 131 },
  },
  {
    title: "Amapiano Night: Labadi",
    slug: "amapiano-night-labadi",
    venue: "Labadi Beach, Sunrise Deck",
    location: "Labadi, Accra",
    mode: "OFFLINE",
    audience: "18+ clubbers, students and diaspora visitors",
    organizer: ORGANIZER_ORG,
    overview:
      "An open-air amapiano session on the Labadi deck, running from golden hour until the tide turns the dancefloor over.",
    description:
      "Six hours of amapiano and gqom on the Labadi deck, with the sun going down behind the Atlantic and the bass lines going until the tide forces the issue. Resident DJs Chanelle, Kwesi the Great and Phumzulo share the decks, joined by a live set from the Accra Dance Collective.\n\nThe deck is fully covered and the bar is cashless. Entry is strictly 18+, and the last shuttle back to the Accra Mall leaves at 02:00.",
    imageUrl:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80",
    agenda: [
      "17:00 - Gates open, sunset set on the main deck",
      "19:00 - Chanelle and Kwesi the Great, live amapiano set",
      "21:30 - Accra Dance Collective live performance",
      "23:00 - Phumzulo takes the deck through to close",
      "02:00 - Final shuttle to the Accra Mall",
    ],
    tags: ["music", "amapiano", "nightlife", "accra", "dance"],
    priceInPesewas: 12000,
    capacity: 600,
    inDays: 26,
    startHourUtc: 17,
    demand: { paid: 470, pending: 118 },
  },
  {
    title: "Chale Wote Arts & Music Festival",
    slug: "chale-wote-arts-music-festival",
    venue: "Chale Wote Street, James Town",
    location: "James Town, Accra",
    mode: "OFFLINE",
    audience: "Families, artists, designers and tourists",
    organizer: "Accra Arts Council",
    overview:
      "Three days of street art, live music and installations running across the painted walls of James Town.",
    description:
      "Chale Wote takes over the streets of James Town for three days of murals, sound installations, live music and food. More than sixty artists work across the neighbourhood, with painting happening in daylight and performance taking over the same walls after dark.\n\nThe festival is walkable and open to children during the day. Sunday morning closes with the Chale Wote Drum Circle at the old lighthouse, free to attend and open to every drum you bring.",
    imageUrl:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80",
    agenda: [
      "12:00 - Friday gates open, street art in progress across James Town",
      "18:00 - Murals completed, live music stage opens",
      "20:00 - Night stage: highlife, afrobeats and alté sets",
      "Day two - Sound installations, panel talks and the design market",
      "Sunday 10:00 - Drum circle at the old lighthouse, free entry",
    ],
    tags: ["arts", "music", "festival", "accra", "culture"],
    priceInPesewas: 25000,
    capacity: 3000,
    inDays: 44,
    startHourUtc: 12,
    demand: { paid: 1290, pending: 250 },
  },
  {
    title: "Kumasi Food Expo",
    slug: "kumasi-food-expo",
    venue: "Kumasi City Mall, Exhibition Centre",
    location: "Lake Road, Kumasi",
    mode: "OFFLINE",
    audience: "Food vendors, restaurateurs, farmers and home cooks",
    organizer: "Ashanti Food Traders Association",
    overview:
      "Two days of Ghanaian street food, market produce and cooking demonstrations from more than eighty vendors.",
    description:
      "The Kumasi Food Expo brings together more than eighty vendors from across the Ashanti region: waakye and kontomire from the Berekum kitchens, tuo zaafi from Tamale, smoked fish from the Volta basin, and cocoa and shea producers selling direct.\n\nEvery ticket includes two tasting tokens, redeemable against any vendor stall. Cooking demonstrations run on the hour across four demo kitchens, and the Sunday session closes with a competition for the best jollof in the Ashanti region.",
    imageUrl:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80",
    agenda: [
      "10:00 - Doors open, tasting tokens and vendor stalls",
      "11:00 - Waakye masterclass with the Berekum Kitchen Collective",
      "13:00 - Produce market: cocoa, shea and smoked fish direct",
      "15:00 - Street food judging, results at 16:30",
      "Sunday 11:00 - Best jollof in the Ashanti region, final",
    ],
    tags: ["food", "culture", "expo", "kumasi", "market"],
    priceInPesewas: 6000,
    capacity: null,
    inDays: 61,
    startHourUtc: 10,
    demand: { paid: 704, pending: 159 },
  },
  {
    title: "Ghana Fintech & Payments Forum",
    slug: "ghana-fintech-payments-forum",
    venue: "Streamed live from Accra",
    location: "Online",
    mode: "ONLINE",
    audience: "Fintech founders, bank product teams and developers",
    organizer: "Fintech Association of Ghana",
    overview:
      "A free online forum on mobile money at scale, merchant acquiring, and the interoperability rules reshaping Ghana's payments market.",
    description:
      "A free half-day forum on the state of Ghana's payments market, streamed live. Panels cover mobile money interoperability, merchant acquiring margins for small traders, and what the payment service provider framework means for startups building on the rails.\n\nRegistration is free, but the stream is capped at the room size our provider will hold, so tickets are issued in order until the cap is reached. Sessions are recorded and sent to every ticket holder afterwards.",
    imageUrl:
      "https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&w=1200&q=80",
    agenda: [
      "09:00 - Opening remarks, the state of the market",
      "09:30 - Mobile money interoperability, what actually changed",
      "10:15 - Merchant acquiring and the small-trader margin",
      "11:00 - Panel: building on the PSP framework",
      "12:00 - Recordings sent to all ticket holders",
    ],
    tags: ["fintech", "online", "payments", "ghana", "conference"],
    priceInPesewas: 0,
    capacity: 500,
    inDays: 78,
    startHourUtc: 9,
    demand: { paid: 372, pending: 48 },
  },
  {
    title: "Adinkra Symbols Masterclass",
    slug: "adinkra-symbols-masterclass",
    venue: "Kumasi Cultural Centre, Studio Two",
    location: "Kumasi",
    mode: "HYBRID",
    audience: "Graphic designers, printers and craft educators",
    organizer: ORGANIZER_ORG,
    overview:
      "A small hands-on masterclass on carving, stamping and correctly applying Adinkra symbols, streamed for remote attendees.",
    description:
      "A deliberately small masterclass on Adinkra: what each symbol means, how the stamps are carved from calabash, and how to apply them with proper spacing and negative space. The session runs hands-on for the in-room attendees, with a live stream and a recording for remote participants.\n\nCalabash, materials and printed reference sheets are included. Bring an apron if you have one, and note that the room seats only forty people.",
    imageUrl:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80",
    agenda: [
      "09:00 - Symbol families and their meanings",
      "10:30 - Carving a calabash stamp, hands-on",
      "13:00 - Stamping cloth and paper, spacing and negative space",
      "15:00 - Common mistakes, and how printers handle a bad impression",
      "15:30 - Recording released to remote attendees",
    ],
    tags: ["design", "culture", "workshop", "kumasi", "craft"],
    priceInPesewas: 40000,
    capacity: 40,
    inDays: 95,
    startHourUtc: 9,
    demand: { paid: 31, pending: 6 },
  },
];

/**
 * Guest checkout is the dominant path in this marketplace, so most fixture
 * buyers deliberately have no account. The three entries repeated in
 * `REGISTERED_BUYERS` are the only ones that become real User rows, which is
 * what gives `Order.userId` and `Ticket.userId` something to point at.
 *
 * Order fixtures use `@example.com` rather than real-looking mailboxes so a
 * seeded confirmation can never be delivered to a real person.
 */
const BUYER_POOL: ReadonlyArray<{ name: string; email: string }> = [
  { name: "Kwame Mensah", email: "kwame.mensah@example.com" },
  { name: "Ama Owusu", email: "ama.owusu@example.com" },
  { name: "Kofi Owusu", email: "kofi.owusu@example.com" },
  { name: "Abena Sarpong", email: "abena.sarpong@example.com" },
  { name: "Yaw Osei", email: "yaw.osei@example.com" },
  { name: "Efua Danso", email: "efua.danso@example.com" },
  { name: "Nana Adjei", email: "nana.adjei@example.com" },
  { name: "Maame Adwoa", email: "adwoa.brobbey@example.com" },
  { name: "Kojo Antwi", email: "kojo.antwi@example.com" },
  { name: "Akosua Frimpong", email: "akosua.frimpong@example.com" },
  { name: "Selorm Agbeko", email: "selorm.agbeko@example.com" },
  { name: "Yaa Asantewaa Boateng", email: "yaa.boateng@example.com" },
  { name: "Kwabena Agyei", email: "kwabena.agyei@example.com" },
  { name: "Afua Nyarko", email: "afua.nyarko@example.com" },
  { name: "Kwesi Amoah", email: "kwesi.amoah@example.com" },
  { name: "Naa Adjeley Lartey", email: "naa.lartey@example.com" },
  { name: "Mawuli Duah", email: "mawuli.duah@example.com" },
  { name: "Esi Armah", email: "esi.armah@example.com" },
  { name: "Baffour Gyimah", email: "baffour.gyimah@example.com" },
  { name: "Akua Nyameye", email: "akua.nyameye@example.com" },
  { name: "Sedem Kpedor", email: "sedem.kpedor@example.com" },
  { name: "Mabel Addo", email: "mabel.addo@example.com" },
  { name: "Prince Kobina Arthur", email: "kobina.arthur@example.com" },
  { name: "Hawa Alhassan", email: "hawa.alhassan@example.com" },
];

const REGISTERED_BUYERS: ReadonlyArray<{ name: string; email: string }> = [
  { name: "Selorm Agbeko", email: "selorm.agbeko@example.com" },
  { name: "Afua Nyarko", email: "afua.nyarko@example.com" },
  { name: "Prince Kobina Arthur", email: "kobina.arthur@example.com" },
];

/* ------------------------------------------------------------ order build */

type OrderSpec = {
  fullName: string;
  email: string;
  quantity: number;
  status: "PAID" | "PENDING";
  userId: string | null;
  createdAt: Date;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Splits a seat budget into per-order quantities that sum to exactly `total` and
 * never exceed the public per-order ceiling. A real order cannot be larger, so
 * selling 1,500 seats means hundreds of plausible small orders rather than a
 * few implausible ones.
 */
function* ticketChunks(rand: () => number, total: number): Generator<number> {
  let remaining = total;
  while (remaining > 0) {
    const quantity = Math.min(remaining, 1 + Math.floor(rand() * MAX_TICKETS_PER_ORDER));
    yield quantity;
    remaining -= quantity;
  }
}

/** cuid-shaped id, so seeded rows look like generated ones in the admin UI. */
function seedId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(24);
  let id = "c";
  for (let i = 0; i < 24; i += 1) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

function buildOrderSpecs(
  rand: () => number,
  demand: EventFixture["demand"],
  now: Date,
  registeredByEmail: Map<string, string>,
): OrderSpec[] {
  const specs: OrderSpec[] = [];
  let buyerCursor = Math.floor(rand() * BUYER_POOL.length);

  // Settled orders ran over the last three weeks. Anything still awaiting
  // payment is recent, because an abandoned checkout does not sit in PENDING
  // for a month in a working marketplace.
  const paidSpanMs = 21 * 24 * 60 * 60 * 1000;
  const pendingSpanMs = 20 * 60 * 60 * 1000;

  const place = (quantity: number, status: OrderSpec["status"], index: number, total: number) => {
    const buyer = BUYER_POOL[buyerCursor % BUYER_POOL.length];
    buyerCursor += 1;

    const span = status === "PAID" ? paidSpanMs : pendingSpanMs;
    const progress = total > 1 ? index / (total - 1) : 1;
    const ageMs = span * (1 - progress) * (0.35 + rand() * 0.65);

    specs.push({
      fullName: buyer.name,
      email: buyer.email,
      quantity,
      status,
      userId: registeredByEmail.get(buyer.email) ?? null,
      createdAt: new Date(now.getTime() - ageMs),
    });
  };

  const paidChunks = [...ticketChunks(rand, demand.paid)];
  paidChunks.forEach((quantity, index) => place(quantity, "PAID", index, paidChunks.length));

  const pendingChunks = [...ticketChunks(rand, demand.pending)];
  pendingChunks.forEach((quantity, index) =>
    place(quantity, "PENDING", index, pendingChunks.length),
  );

  return specs;
}

function futureDate(daysFromNow: number, hourUtc: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}

/* ---------------------------------------------------------------- output */

const colorEnabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const paint =
  (code: string) =>
  (text: string): string =>
    colorEnabled ? `\u001B[${code}m${text}\u001B[0m` : text;

const bold = paint("1");
const dim = paint("2");
const red = paint("31");
const green = paint("32");
const yellow = paint("33");
const blue = paint("36");
const magenta = paint("35");

const RULE = dim("─".repeat(66));

const ghs = (pesewas: number) => `GHS ${(pesewas / 100).toFixed(2)}`;

const stamp = (date: Date) => date.toISOString().replace("T", " ").slice(0, 16);

function padEnd(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

type SummaryEvent = {
  title: string;
  mode: EventMode;
  eventDate: Date;
  priceInPesewas: number;
  capacity: number | null;
  ticketsSold: number;
  orders: { paid: number; pending: number };
};

function printSummary(
  events: SummaryEvent[],
  counts: { users: number; orders: number; tickets: number },
) {
  const titleWidth = Math.max(...events.map((event) => event.title.length));

  console.log("");
  console.log(`  ${bold("Seeded events")}`);
  console.log(`  ${RULE}`);

  for (const event of events) {
    const remaining = event.capacity === null ? null : event.capacity - event.ticketsSold;

    const stock =
      remaining === null
        ? `${event.ticketsSold} sold / unlimited`
        : remaining <= 0
          ? "SOLD OUT"
          : `${event.ticketsSold} / ${event.capacity}`;

    const colored =
      remaining !== null && remaining <= 0
        ? magenta(padEnd(stock, 24))
        : remaining !== null && remaining <= 10
          ? yellow(padEnd(stock, 24))
          : padEnd(stock, 24);

    console.log(
      `  ${bold(padEnd(event.title, titleWidth))}  ` +
        `${dim(padEnd(event.mode, 8))}${colored}` +
        `${padStart(ghs(event.priceInPesewas), 12)}  ` +
        `${dim(stamp(event.eventDate))}`,
    );
  }

  const paidOrders = events.reduce((sum, event) => sum + event.orders.paid, 0);
  const pendingOrders = events.reduce((sum, event) => sum + event.orders.pending, 0);

  console.log(`  ${RULE}`);
  console.log(
    `  ${dim("users")} ${padStart(String(counts.users), 4)}    ` +
      `${dim("orders")} ${padStart(String(counts.orders), 5)} ` +
      `${dim(`(${paidOrders} paid / ${pendingOrders} pending)`)}    ` +
      `${dim("tickets")} ${padStart(String(counts.tickets), 5)}`,
  );
}

/* ------------------------------------------------------------------- seed */

async function main(): Promise<void> {
  console.log("");
  console.log(`  ${bold(blue("event-ticketing"))}${dim(" · database seed")}`);
  console.log(`  ${RULE}`);

  if (process.env.NODE_ENV === "production") {
    console.error(`  ${red("✖")} Refusing to seed with NODE_ENV=production.`);
    console.error(`  ${red("✖")} This script deletes every Ticket, Order, Event and User row.`);
    process.exitCode = 1;
    return;
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? DEV_ADMIN_EMAIL).toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD ?? DEV_ADMIN_PASSWORD;
  const usingDevAdminPassword = !process.env.ADMIN_PASSWORD;

  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  const now = new Date();
  const rand = mulberry32(FIXTURE_SEED);

  // Hashed before the transaction opens: bcrypt at cost 12 is deliberately slow,
  // and holding a write transaction open across it would stall the whole seed.
  console.log(`  ${blue("▸")} Hashing passwords with bcrypt (cost ${BCRYPT_ROUNDS})…`);
  const [adminPasswordHash, organizerPasswordHash, buyerPasswordHash] = await Promise.all([
    bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
    bcrypt.hash(DEV_ORGANIZER_PASSWORD, BCRYPT_ROUNDS),
    bcrypt.hash(DEV_BUYER_PASSWORD, BCRYPT_ROUNDS),
  ]);

  const seeded = await prisma.$transaction(async (tx) => {
    const removed = {
      tickets: (await tx.ticket.deleteMany()).count,
      orders: (await tx.order.deleteMany()).count,
      events: (await tx.event.deleteMany()).count,
      users: (await tx.user.deleteMany()).count,
    };

    const admin = await tx.user.create({
      data: {
        email: adminEmail,
        name: "Administrator",
        role: "ADMIN",
        passwordHash: adminPasswordHash,
      },
      select: { id: true, email: true },
    });

    const organizer = await tx.user.create({
      data: {
        email: DEV_ORGANIZER_EMAIL,
        name: ORGANIZER_NAME,
        role: "USER",
        passwordHash: organizerPasswordHash,
      },
      select: { id: true, email: true },
    });

    const buyers = await Promise.all(
      REGISTERED_BUYERS.map((buyer) =>
        tx.user.create({
          data: {
            email: buyer.email,
            name: buyer.name,
            role: "USER",
            passwordHash: buyerPasswordHash,
          },
          select: { id: true, email: true },
        }),
      ),
    );

    const registeredByEmail = new Map(buyers.map((buyer) => [buyer.email, buyer.id]));

    const summary: SummaryEvent[] = [];
    let orderCount = 0;
    let ticketCount = 0;

    for (const fixture of EVENT_FIXTURES) {
      const eventDate = futureDate(fixture.inDays, fixture.startHourUtc);

      // Parsed through the app's own write schema, so a fixture that breaks a
      // documented bound (title length, agenda size, URL shape) fails loudly
      // here instead of surfacing as a broken card in the UI.
      const validated = eventWriteSchema.parse({
        title: fixture.title,
        description: fixture.description,
        overview: fixture.overview,
        eventDate: eventDate.toISOString(),
        mode: fixture.mode,
        priceInPesewas: fixture.priceInPesewas,
        capacity: fixture.capacity,
        agenda: fixture.agenda,
        tags: fixture.tags,
        imageUrl: fixture.imageUrl,
        venue: fixture.venue,
        location: fixture.location,
        audience: fixture.audience,
        organizer: fixture.organizer,
      });

      const capacity = validated.capacity ?? null;

      const specs = buildOrderSpecs(rand, fixture.demand, now, registeredByEmail);
      const reserved = specs.reduce((sum, spec) => sum + spec.quantity, 0);

      // The same bound the oversell check in createPendingOrder enforces. A
      // fixture reserving more seats than the venue holds would leave a seeded
      // database the app itself considers oversold.
      if (capacity !== null && reserved > capacity) {
        throw new Error(
          `Fixture "${fixture.title}" reserves ${reserved} tickets against a capacity of ${capacity}`,
        );
      }

      const event = await tx.event.create({
        data: {
          title: validated.title,
          slug: fixture.slug,
          description: validated.description,
          overview: validated.overview,
          eventDate,
          mode: validated.mode,
          audience: validated.audience,
          agenda: validated.agenda,
          organizer: validated.organizer,
          organizerId: fixture.organizer === ORGANIZER_ORG ? organizer.id : null,
          tags: validated.tags,
          priceInPesewas: validated.priceInPesewas,
          // `capacity` is `.optional()` on the write schema, so an absent value
          // and an explicit `null` ("no limit") both land here.
          capacity,
          imageUrl: validated.imageUrl,
          venue: validated.venue,
          location: validated.location,
          // Written explicitly rather than left at 0: this is the reservation
          // counter every public availability bar reads.
          ticketsSold: reserved,
        },
        select: { id: true },
      });

      const orderRows = specs.map((spec) => ({
        id: seedId(),
        eventId: event.id,
        userId: spec.userId,
        fullName: spec.fullName,
        email: spec.email,
        quantity: spec.quantity,
        amountInPesewas: validated.priceInPesewas * spec.quantity,
        // Recognisable in the admin UI, and still the same shape and
        // uniqueness guarantee as a real Paystack reference.
        paystackReference: `evt_seed_${randomBytes(12).toString("hex")}`,
        status: spec.status,
        createdAt: spec.createdAt,
      }));

      await tx.order.createMany({ data: orderRows });
      orderCount += orderRows.length;

      // Tickets are minted at settlement, not at checkout, so only settled
      // orders get any: a PENDING order in this database has zero tickets,
      // exactly as in production.
      const paidRows = specs
        .map((spec, index) => ({ spec, row: orderRows[index] }))
        .filter((entry) => entry.spec.status === "PAID");

      if (paidRows.length > 0) {
        const ticketRows = paidRows.flatMap(({ spec, row }) =>
          Array.from({ length: spec.quantity }, () => ({
            orderId: row.id,
            eventId: event.id,
            userId: spec.userId,
            status: "ISSUED" as const,
            qrCodeToken: generateQrCodeToken(),
            createdAt: spec.createdAt,
          })),
        );

        await tx.ticket.createMany({ data: ticketRows });
        ticketCount += ticketRows.length;
      }

      summary.push({
        title: fixture.title,
        mode: validated.mode,
        eventDate,
        priceInPesewas: validated.priceInPesewas,
        capacity,
        ticketsSold: reserved,
        orders: {
          paid: paidRows.length,
          pending: specs.length - paidRows.length,
        },
      });
    }

    return { removed, admin, organizer, buyerCount: buyers.length, summary, orderCount, ticketCount };
  });

  console.log(
    `  ${green("✔")} Cleared ${seeded.removed.tickets} tickets, ${seeded.removed.orders} orders, ` +
      `${seeded.removed.events} events, ${seeded.removed.users} users`,
  );
  console.log(
    `  ${green("✔")} Created ${seeded.summary.length} events, ${seeded.orderCount} orders, ` +
      `${seeded.ticketCount} tickets`,
  );
  console.log(
    `  ${green("✔")} Created ${2 + seeded.buyerCount} users ` +
      `(${seeded.admin.email} ADMIN, ${seeded.organizer.email} organizer)`,
  );

  if (usingDevAdminPassword) {
    console.log(
      `  ${yellow("!")} Admin seeded with the built-in development password ` +
        `${dim("— set ADMIN_EMAIL / ADMIN_PASSWORD before sharing this database")}`,
    );
  }

  printSummary(seeded.summary, {
    users: 2 + seeded.buyerCount,
    orders: seeded.orderCount,
    tickets: seeded.ticketCount,
  });

  console.log("");
  console.log(`  ${bold("Admin sign-in")} ${dim("/admin/login")}`);
  console.log(`  ${RULE}`);
  console.log(`  ${dim("email")}    ${bold(seeded.admin.email)}`);
  console.log(`  ${dim("password")} ${bold(adminPassword)}`);
  console.log("");
  console.log(`  ${RULE}`);
  console.log(
    `  ${dim("Next:")} ${blue("npm run dev")} ${dim("→")} ${blue("http://localhost:3000")}` +
      ` ${dim("· admin at")} ${blue("/admin/login")}`,
  );
  console.log("");
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error(`  ${red("✖")} ${bold(red("Seed failed."))} The database was left unchanged.`);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ${red(message)}`);
    if (error instanceof Error && error.stack) {
      console.error(dim(error.stack.split("\n").slice(1, 4).join("\n")));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
