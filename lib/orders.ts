import type { TicketStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { generatePaystackReference, generateQrCodeToken } from "@/lib/tokens";
import { MAX_TICKETS_PER_ORDER } from "@/lib/validators/payment.schema";

export class OrderError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "SOLD_OUT"
      | "CONFLICT"
      | "INVALID_QUANTITY"
      | "ALREADY_PROCESSED"
      | "AMOUNT_MISMATCH"
      | "CURRENCY_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

const EXPECTED_CURRENCY = "GHS";

export type CreateOrderInput = {
  eventId: string;
  email: string;
  fullName: string;
  quantity: number;
  userId?: string;
};

export async function createPendingOrder(input: CreateOrderInput) {
  const quantity = Math.trunc(input.quantity);

  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
    throw new OrderError("INVALID_QUANTITY", `Quantity must be between 1 and ${MAX_TICKETS_PER_ORDER}`);
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      select: { id: true, priceInPesewas: true, capacity: true, ticketsSold: true },
    });

    if (!event) {
      throw new OrderError("NOT_FOUND", "Event not found");
    }

    if (event.capacity != null && event.ticketsSold + quantity > event.capacity) {
      throw new OrderError("SOLD_OUT", "Not enough tickets remaining");
    }

    const claimed = await tx.event.updateMany({
      where: { id: event.id, ticketsSold: event.ticketsSold },
      data: { ticketsSold: { increment: quantity } },
    });

    if (claimed.count === 0) {
      throw new OrderError("CONFLICT", "Inventory changed, please retry");
    }

    return tx.order.create({
      data: {
        eventId: event.id,
        userId: input.userId ?? null,
        email: input.email.toLowerCase().trim(),
        fullName: input.fullName.trim(),
        quantity,
        amountInPesewas: event.priceInPesewas * quantity,
        paystackReference: generatePaystackReference(),
        status: "PENDING",
      },
      select: { id: true, paystackReference: true, amountInPesewas: true, quantity: true },
    });
  });
}

export type SettleOrderInput = {
  paystackReference: string;
  amountInPesewas: number;
  currency: string;
};

/**
 * Settles a paid order and mints its tickets in a single transaction, so an
 * order is never marked PAID without the matching tickets existing.
 *
 * Only ever call this after the `x-paystack-signature` HMAC has been verified:
 * this function is the one place in the app that grants admission.
 */
export async function markOrderPaidAndIssueTickets(input: SettleOrderInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { paystackReference: input.paystackReference },
      select: {
        id: true,
        status: true,
        quantity: true,
        eventId: true,
        userId: true,
        amountInPesewas: true,
      },
    });

    if (!order) {
      throw new OrderError("NOT_FOUND", "Order not found");
    }

    if (order.status !== "PENDING") {
      throw new OrderError("ALREADY_PROCESSED", `Order already ${order.status}`);
    }

    // Money is in our account, so the charge has to match the order exactly
    // before tickets are issued. Checking the settled amount and the currency
    // here means an underpaid or foreign-currency charge can never be promoted
    // to PAID, and the failure surfaces as a refund case rather than bad data.
    if (input.amountInPesewas !== order.amountInPesewas) {
      throw new OrderError(
        "AMOUNT_MISMATCH",
        `Expected ${order.amountInPesewas} pesewas but charge settled ${input.amountInPesewas}`,
      );
    }

    if (input.currency.toUpperCase() !== EXPECTED_CURRENCY) {
      throw new OrderError(
        "CURRENCY_MISMATCH",
        `Expected ${EXPECTED_CURRENCY} but charge settled ${input.currency}`,
      );
    }

    // DECISION: stock is verified here but not decremented. createPendingOrder
    // already incremented Event.ticketsSold when the order was created, so
    // this order's seats are reserved. Decrementing again at payment time would
    // under-count Event.ticketsSold and let the event oversell its capacity.
    const event = await tx.event.findUnique({
      where: { id: order.eventId },
      select: { id: true, capacity: true, ticketsSold: true },
    });

    if (!event) {
      throw new OrderError("NOT_FOUND", "Event not found");
    }

    if (event.capacity != null && event.ticketsSold > event.capacity) {
      throw new OrderError(
        "SOLD_OUT",
        `Event is oversold (${event.ticketsSold}/${event.capacity}); resolve capacity before issuing`,
      );
    }

    // Compare-and-swap on PENDING: if two deliveries of the same webhook race,
    // only one wins the update and only one call mints tickets.
    const settled = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "PAID" },
    });

    if (settled.count === 0) {
      throw new OrderError("ALREADY_PROCESSED", "Order was settled by a concurrent delivery");
    }

    // A qrCodeToken collision rolls the whole transaction back, including the
    // PENDING -> PAID transition, so a duplicate token can never be persisted.
    await tx.ticket.createMany({
      data: Array.from({ length: order.quantity }, () => ({
        orderId: order.id,
        eventId: order.eventId,
        userId: order.userId,
        status: "ISSUED" as const,
        qrCodeToken: generateQrCodeToken(),
      })),
    });

    return { orderId: order.id, issued: order.quantity };
  });
}

export async function failOrderAndReleaseStock(paystackReference: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { paystackReference },
      select: { id: true, status: true, quantity: true, eventId: true },
    });

    if (!order) {
      throw new OrderError("NOT_FOUND", "Order not found");
    }

    if (order.status !== "PENDING") {
      throw new OrderError("ALREADY_PROCESSED", `Order already ${order.status}`);
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });

    await tx.event.updateMany({
      where: { id: order.eventId },
      data: { ticketsSold: { decrement: order.quantity } },
    });

    return { orderId: order.id };
  });
}

/**
 * Everything the gate UI needs to render a decision. A flat shape with a
 * discriminated `outcome` keeps the Client Component free of null-checks in
 * the common path while still modelling "we know nothing about this token".
 *
 * `NOT_ISSUED`/`VOID`/`EXPIRED` are derived from the Prisma enum rather than
 * hardcoded, so adding a TicketStatus forces this type to be revisited.
 */
export type RedeemOutcome = "ADMITTED" | "ALREADY_USED" | "NOT_FOUND" | Exclude<TicketStatus, "ISSUED" | "USED">;

export type RedeemResult = {
  outcome: RedeemOutcome;
  ticketId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  holderName: string | null;
  /** Set only when this scan is the one that admitted the holder. */
  scannedAt: Date | null;
  /** On ALREADY_USED this is the time of the original scan. */
  usedAt: Date | null;
};

/**
 * Redeems a ticket for entry. Returns a result rather than throwing so a
 * rejected scan is an expected outcome, not an exception.
 *
 * Only "ISSUED" admits. Every other state is reported so the gate can say
 * *why* a holder was turned away instead of a bare rejection.
 */
export async function redeemTicket(qrCodeToken: string, scannedAt: Date = new Date()): Promise<RedeemResult> {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { qrCodeToken },
      select: {
        id: true,
        status: true,
        eventId: true,
        usedAt: true,
        event: { select: { title: true } },
        order: { select: { fullName: true } },
      },
    });

    if (!ticket) {
      return {
        outcome: "NOT_FOUND",
        ticketId: null,
        eventId: null,
        eventTitle: null,
        holderName: null,
        scannedAt: null,
        usedAt: null,
      };
    }

    const details = {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      eventTitle: ticket.event.title,
      holderName: ticket.order.fullName,
      scannedAt: null as Date | null,
      usedAt: ticket.usedAt,
    };

    if (ticket.status === "USED") {
      return { outcome: "ALREADY_USED", ...details };
    }

    if (ticket.status !== "ISSUED") {
      return { outcome: ticket.status, ...details };
    }

    // Compare-and-swap on ISSUED. Two gate lanes (or a double-tap on one phone)
    // can both reach this point; only the one whose UPDATE matches a row is
    // allowed to admit, so a single ticket can never admit twice.
    const redeemed = await tx.ticket.updateMany({
      where: { id: ticket.id, status: "ISSUED" },
      data: { status: "USED", usedAt: scannedAt },
    });

    if (redeemed.count === 0) {
      // Lost the race. Report as a duplicate so the gate never admits twice.
      return { outcome: "ALREADY_USED", ...details, usedAt: scannedAt };
    }

    return { outcome: "ADMITTED", ...details, scannedAt, usedAt: scannedAt };
  });
}
