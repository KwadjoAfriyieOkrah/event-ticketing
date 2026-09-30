import { randomUUID } from "node:crypto";

import { createPendingOrder, markOrderPaidAndIssueTickets, redeemTicket } from "./lib/orders";
import { prisma } from "./lib/prisma";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, extra?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`, extra ?? "");
  }
}

async function main() {
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.event.deleteMany();

  const event = await prisma.event.create({
    data: {
      title: "Gate Test Event",
      slug: `gate-${randomUUID().slice(0, 8)}`,
      description: "", overview: "", imageUrl: "https://example.com/a.jpg",
      venue: "V", location: "L", eventDate: new Date(Date.now() + 86_400_000),
      mode: "OFFLINE", audience: "A", agenda: ["a"], organizer: "O",
      tags: ["t"], priceInPesewas: 1000, capacity: 50,
    },
  });

  async function mint(quantity: number) {
    const order = await createPendingOrder({
      eventId: event.id, email: "gate@test.local", fullName: "Ada Lovelace", quantity,
    });
    await markOrderPaidAndIssueTickets({
      paystackReference: order.paystackReference,
      amountInPesewas: order.amountInPesewas,
      currency: "GHS",
    });
    const tickets = await prisma.ticket.findMany({
      where: { orderId: order.id }, select: { qrCodeToken: true },
    });
    return { orderId: order.id, tokens: tickets.map((t) => t.qrCodeToken) };
  }

  // ---- 1. first scan admits -------------------------------------------------
  const batch = await mint(2);
  const token = batch.tokens[0];

  const first = await redeemTicket(token);
  check("first scan -> ADMITTED", first.outcome === "ADMITTED", first.outcome);
  check("ADMITTED carries event title", first.eventTitle === "Gate Test Event", first.eventTitle);
  check("ADMITTED carries holder name", first.holderName === "Ada Lovelace", first.holderName);
  check("ADMITTED records a scan time", first.scannedAt instanceof Date, first.scannedAt);

  const row = await prisma.ticket.findUniqueOrThrow({ where: { qrCodeToken: token } });
  check("status is USED in the database", row.status === "USED", row.status);
  check("usedAt persisted", row.usedAt instanceof Date, row.usedAt);
  check(
    "usedAt matches the reported scan time",
    row.usedAt?.getTime() === first.scannedAt?.getTime(),
    { usedAt: row.usedAt, scannedAt: first.scannedAt },
  );

  // ---- 2. rescan is a duplicate, and reports the original time -------------
  const second = await redeemTicket(token);
  check("rescan -> ALREADY_USED", second.outcome === "ALREADY_USED", second.outcome);
  check("ALREADY_USED reports the first scan time", second.usedAt?.getTime() === first.scannedAt?.getTime());
  check("ALREADY_USED is not a new scan time", second.scannedAt === null, second.scannedAt);
  check("ALREADY_USED still identifies the event", second.eventTitle === "Gate Test Event");

  // ---- 3. sibling ticket in the same order is untouched ---------------------
  const sibling = await redeemTicket(batch.tokens[1]);
  check("sibling ticket still admits", sibling.outcome === "ADMITTED", sibling.outcome);

  // ---- 4. unknown token ----------------------------------------------------
  const missing = await redeemTicket(randomUUID());
  check("unknown token -> NOT_FOUND", missing.outcome === "NOT_FOUND", missing.outcome);
  check("NOT_FOUND leaks no ticket id", missing.ticketId === null, missing.ticketId);
  check("NOT_FOUND leaks no event title", missing.eventTitle === null, missing.eventTitle);

  // ---- 5. non-admitting states are distinguished ---------------------------
  for (const status of ["VOID", "EXPIRED", "PENDING"] as const) {
    const b = await mint(1);
    await prisma.ticket.update({ where: { qrCodeToken: b.tokens[0] }, data: { status } });
    const out = await redeemTicket(b.tokens[0]);
    check(`${status} ticket is reported as ${status}, not admitted`, out.outcome === status, out.outcome);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { qrCodeToken: b.tokens[0] } });
    check(`${status} ticket is not mutated by a scan`, after.status === status, after.status);
  }

  // ---- 6. concurrency: one ticket, many simultaneous gates -----------------
  const race = await mint(1);
  const settled = await Promise.all(
    Array.from({ length: 8 }, () => redeemTicket(race.tokens[0])),
  );
  const admitted = settled.filter((r) => r.outcome === "ADMITTED");
  const duplicates = settled.filter((r) => r.outcome === "ALREADY_USED");
  check("exactly one of 8 concurrent scans admits", admitted.length === 1, admitted.length);
  check("the other 7 report ALREADY_USED", duplicates.length === 7, duplicates.length);
  const ticketsForOrder = await prisma.ticket.count({
    where: { orderId: race.orderId, status: "USED" },
  });
  check("exactly one ticket marked USED", ticketsForOrder === 1, ticketsForOrder);

  // ---- 7. usedAt is the exact injected scan time --------------------------
  const stamped = await mint(1);
  const exact = new Date("2031-03-04T05:06:07.008Z");
  const stampedResult = await redeemTicket(stamped.tokens[0], exact);
  const stampedRow = await prisma.ticket.findUniqueOrThrow({ where: { qrCodeToken: stamped.tokens[0] } });
  check("scan time is stored to the millisecond", stampedRow.usedAt?.getTime() === exact.getTime(), stampedRow.usedAt);
  check("scan time is echoed back", stampedResult.scannedAt?.getTime() === exact.getTime());

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
