import { z } from "zod";

/**
 * Paystack webhook payloads. Only the fields this app acts on are modelled, and
 * the objects stay loose so that fields Paystack adds later never cause a
 * legitimate, signature-verified event to be rejected.
 */
const chargeReferenceSchema = z
  .string()
  .min(1)
  .max(64)
  // We generate `evt_<hex>` via generatePaystackReference(). The character
  // class stays deliberately wider than that so a future format change cannot
  // block an order that has already been paid for, while still rejecting
  // anything that could not have come from us.
  .regex(/^[A-Za-z0-9_-]+$/, "reference contains unsupported characters");

/**
 * The envelope. Only the reference is required, because the charge.failed
 * payload is not guaranteed to carry settlement fields and the failure path
 * must still be able to release reserved stock.
 */
export const paystackWebhookSchema = z.looseObject({
  event: z.string().min(1).max(64),
  data: z.looseObject({
    id: z.union([z.number(), z.string()]).optional(),
    reference: chargeReferenceSchema,
  }),
});

/**
 * Settlement fields, required only for events that grant admission. Validated
 * separately so that a charge.success missing them is rejected before any
 * database write is attempted.
 */
export const paystackChargeSuccessSchema = z.looseObject({
  id: z.union([z.number(), z.string()]).optional(),
  reference: chargeReferenceSchema,
  amount: z.number().int().nonnegative(),
  currency: z.string().min(3).max(8),
  status: z.string().min(1).max(32),
});

export type PaystackWebhookEvent = z.infer<typeof paystackWebhookSchema>;
export type PaystackChargeSuccess = z.infer<typeof paystackChargeSuccessSchema>;
