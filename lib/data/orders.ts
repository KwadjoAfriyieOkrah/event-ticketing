import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * DECISION: an explicit column list, not the whole row.
 *
 * This payload is rendered to an unauthenticated visitor whose only credential is
 * the reference in the URL, so every field that crosses this boundary is named
 * deliberately. `User.passwordHash` is unreachable through this projection even
 * by accident, and adding a column to the Order model cannot silently start
 * publishing it on a page that holds an admission credential.
 *
 * `tickets` is included because the QR token is the whole point of the page, but
 * only the four fields needed to render and label a ticket are selected: the
 * token itself, its status, when it was used, and its id for display.
 */
const orderConfirmationSelect = {
  id: true,
  fullName: true,
  email: true,
  quantity: true,
  amountInPesewas: true,
  paystackReference: true,
  status: true,
  createdAt: true,
  event: {
    select: {
      id: true,
      title: true,
      imageUrl: true,
      venue: true,
      location: true,
      eventDate: true,
      mode: true,
      organizer: true,
    },
  },
  tickets: {
    select: {
      id: true,
      qrCodeToken: true,
      status: true,
      usedAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.OrderSelect;

export type OrderConfirmation = Prisma.OrderGetPayload<{ select: typeof orderConfirmationSelect }>;

/**
 * Looks up an order by the reference Paystack sent back on the callback URL.
 *
 * This is a single indexed `findUnique` on the `paystackReference` unique index.
 * It is deliberately not cached: the same buyer landing on this URL twice must
 * see the settlement the webhook applied in between, and a cached "PENDING" would
 * strand them on a page that never resolves.
 *
 * Returns `null` for an unknown reference rather than throwing, because a missing
 * or stale reference is an expected outcome of a redirect, not an error.
 */
export async function getOrderConfirmation(reference: string): Promise<OrderConfirmation | null> {
  return prisma.order.findUnique({
    where: { paystackReference: reference },
    select: orderConfirmationSelect,
  });
}
