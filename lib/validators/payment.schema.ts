import { z } from "zod";

/**
 * The public purchase ceiling. Exported so the order writer and the purchase
 * form derive the same number, and so the two can never drift apart.
 */
export const MAX_TICKETS_PER_ORDER = 10;

/**
 * What the browser is allowed to ask for. Strict, because this object crosses
 * the network from an untrusted client into a Server Action: `.strict()` rejects
 * any extra key outright rather than silently ignoring a smuggled field.
 *
 * Note what is *not* here — no amount, no price, no capacity, no reference.
 * The client states intent (which event, how many, who for) and the server
 * derives every figure that touches money. A client that sends `amount: 1` is
 * rejected, and a client that omits it cannot influence the charge.
 *
 * `z.coerce.number()` accepts the string a number input or a query string
 * produces, and the subsequent `.int()` rejects `2.5`, `NaN` and `Infinity`.
 */
export const initializePaymentSchema = z
  .object({
    eventId: z
      .string()
      .min(1, "Missing event")
      .max(64, "Invalid event reference"),
    fullName: z
      .string()
      .trim()
      .min(2, "Enter the name that will go on the ticket")
      .max(100, "Name must be at most 100 characters"),
    email: z
      .email("Enter a valid email address")
      .max(254, "Email must be at most 254 characters")
      .transform((value) => value.toLowerCase()),
    quantity: z.coerce
      .number()
      .int("Ticket quantity must be a whole number")
      .min(1, "Buy at least 1 ticket")
      .max(MAX_TICKETS_PER_ORDER, `Maximum ${MAX_TICKETS_PER_ORDER} tickets per order`),
  })
  .strict();

export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;

/**
 * Paystack's `POST /transaction/initialize` response.
 *
 * It is a third-party response on the critical path of a redirect, so it is
 * validated rather than trusted. `looseObject` keeps the schema tolerant of
 * fields Paystack adds later while still requiring the ones this app acts on.
 * `authorization_url` is the string the browser is about to be sent to, so a
 * missing or empty value must be a typed failure here, not `undefined`
 * reaching a `location.assign` call.
 */
export const paystackInitializeResponseSchema = z.looseObject({
  status: z.boolean(),
  message: z.string().max(500).optional(),
  data: z.looseObject({
    authorization_url: z.string().min(1),
    reference: z.string().min(1).max(64),
    access_code: z.string().max(255).optional(),
  }),
});
