"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderError, createPendingOrder, failOrderAndReleaseStock } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { ticketAvailability } from "@/lib/data/events";
import {
  initializePaymentSchema,
  paystackInitializeResponseSchema,
} from "@/lib/validators/payment.schema";

/**
 * Buyer-facing payment initiation.
 *
 * This module is the trust boundary of checkout, and a Server Action is not a
 * privileged endpoint: Next.js encrypts the action id and rejects a mismatched
 * `Origin`, but anyone who can send the POST can call it. Nothing here may trust
 * the caller, so the order of operations is deliberate:
 *
 *   1. rate limit, so the endpoint cannot be used to mint orders in bulk;
 *   2. Zod validation of the request's *shape* (strict, so extra keys are
 *      rejected rather than ignored);
 *   3. a stock read, to refuse an impossible order before anything is written
 *      and before the payment provider is contacted;
 *   4. `createPendingOrder`, which re-checks stock and reserves the seats with
 *      a compare-and-swap inside a transaction — the authoritative guard,
 *      because the value read in 3 is stale the moment another buyer commits;
 *   5. Paystack transaction initialisation, where the amount is the server's own
 *      `priceInPesewas * quantity` and never anything the client sent;
 *   6. Zod validation plus an https host allowlist on the returned
 *      authorization URL before the browser is sent to it;
 *   7. release of the reservation on every failure path after 4, so a customer
 *      who never reached Paystack does not lose tickets to a dead hold.
 */

const PAYSTACK_INITIALIZE_URL = "https://api.paystack.co/transaction/initialize";
const CURRENCY = "GHS";
const PAYSTACK_TIMEOUT_MS = 10_000;
const CALLBACK_PATH = "/checkout/complete";

/**
 * The only host a buyer may be redirected to. A spoofed or compromised upstream
 * response must not be able to steer the browser to an attacker-controlled page
 * dressed up to look like Paystack's checkout.
 */
const ALLOWED_CHECKOUT_HOSTNAMES = new Set(["checkout.paystack.com"]);

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

export type PaymentInitErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "SOLD_OUT"
  | "EVENT_CLOSED"
  | "CONFLICT"
  | "PAYSTACK_UNAVAILABLE"
  | "UNSAFE_REDIRECT"
  | "NOT_CONFIGURED";

export type InitializePaymentResult =
  | {
      success: true;
      /** Validated to be an https URL on an allowlisted Paystack host. */
      authorizationUrl: string;
      reference: string;
      amountInPesewas: number;
      quantity: number;
    }
  | { success: false; error: string; code: PaymentInitErrorCode };

export async function initializePayment(input: unknown): Promise<InitializePaymentResult> {
  // ---- 1. rate limit -------------------------------------------------------
  // Keyed on the submitted address so a single buyer cannot be used to exhaust
  // the endpoint, and low enough that a scripted run of orders shows up in logs.
  if (!rateLimit(`payment:init:${rateLimitSubject(input)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS).success) {
    return {
      success: false,
      code: "RATE_LIMITED",
      error: "Too many checkout attempts. Please wait a few minutes and try again.",
    };
  }

  // ---- 2. validate the shape of the request --------------------------------
  const parsed = initializePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid checkout details",
    };
  }

  const { eventId, email, fullName, quantity } = parsed.data;

  // ---- 3. check remaining stock --------------------------------------------
  // A read, not the guard. It exists to refuse an impossible order before a row
  // is written and before Paystack is called, and to say precisely how many
  // tickets are left. `createPendingOrder` re-checks authoritatively.
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

  if (!event) {
    return { success: false, code: "NOT_FOUND", error: "That event is no longer available." };
  }

  if (event.eventDate.getTime() <= Date.now()) {
    return {
      success: false,
      code: "EVENT_CLOSED",
      error: "Ticket sales for this event have closed.",
    };
  }

  const availability = ticketAvailability(event);
  if (availability.soldOut) {
    return { success: false, code: "SOLD_OUT", error: "This event is sold out." };
  }

  if (availability.remaining != null && quantity > availability.remaining) {
    return {
      success: false,
      code: "SOLD_OUT",
      error: `Only ${availability.remaining} ticket${availability.remaining === 1 ? "" : "s"} left.`,
    };
  }

  // ---- 4. reserve the seats and create the order ---------------------------
  let order: Awaited<ReturnType<typeof createPendingOrder>>;
  try {
    order = await createPendingOrder({
      eventId,
      email,
      fullName,
      quantity,
      userId: await optionalUserId(),
    });
  } catch (error) {
    return fromOrderError(error);
  }

  // From here the order holds a real reservation, so every exit path must give
  // it back. `releaseQuietly` below is called explicitly on each failure rather
  // than from a `finally`, so that "the reservation was spent" is always visible
  // at the point where it happens.

  // ---- 5. initialize the Paystack transaction ------------------------------
  // `amount` is the order's own pesewas total, computed from the database price.
  // The client cannot influence it, and the webhook re-checks the settled amount
  // against this same integer before any ticket is issued.
  let initialized: InitializeOutcome;
  try {
    initialized = await initializePaystackTransaction({
      email,
      amountInPesewas: order.amountInPesewas,
      reference: order.paystackReference,
      metadata: {
        order_id: order.id,
        event_id: eventId,
        event_title: event.title,
        quantity,
        source: "web",
      },
    });
  } catch (error) {
    // initializePaystackTransaction handles its own transport failures; this
    // catches anything unexpected so it can never escape past the release below.
    console.error("Payment initialization threw after the order was reserved", {
      reference: order.paystackReference,
      error,
    });
    initialized = { ok: false, reason: "upstream" };
  }

  if (!initialized.ok) {
    await releaseQuietly(order.paystackReference);

    console.error("Paystack transaction initialization failed", {
      reference: order.paystackReference,
      reason: initialized.reason,
    });

    return {
      success: false,
      code: initialized.reason === "not_configured" ? "NOT_CONFIGURED" : "PAYSTACK_UNAVAILABLE",
      error:
        initialized.reason === "not_configured"
          ? "Payments are not configured yet. Please try again later."
          : "We could not reach the payment provider. Nothing has been charged — please try again.",
    };
  }

  // ---- 6. vet the redirect target before handing it to the browser --------
  if (!isTrustedCheckoutUrl(initialized.authorizationUrl)) {
    await releaseQuietly(order.paystackReference);

    console.error("Rejected a Paystack authorization URL on an unexpected host", {
      reference: order.paystackReference,
      host: hostOf(initialized.authorizationUrl),
    });

    return {
      success: false,
      code: "UNSAFE_REDIRECT",
      error: "The payment provider returned an unexpected checkout address.",
    };
  }

  return {
    success: true,
    authorizationUrl: initialized.authorizationUrl,
    reference: order.paystackReference,
    amountInPesewas: order.amountInPesewas,
    quantity,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Rate-limit key taken from the raw input *before* validation, so a flood of
 * malformed requests is throttled by address too. Falls back to a shared bucket
 * for input with no usable email, which is the conservative choice.
 */
function rateLimitSubject(input: unknown): string {
  if (typeof input !== "object" || input === null) return "anonymous";

  const email = (input as { email?: unknown }).email;
  if (typeof email !== "string" || email.length === 0) return "anonymous";

  return email.toLowerCase().slice(0, 254);
}

/**
 * A signed-in buyer gets their order tied to their account; a guest is the normal
 * case on a public ticket page, so an absent session is not an error. The id
 * comes from the server session and never from the request body. A session that
 * fails to read is treated as no session, because failing to read a cookie must
 * never be the reason a purchase cannot start.
 */
async function optionalUserId(): Promise<string | undefined> {
  try {
    const session = await auth();
    return session?.user?.id;
  } catch {
    return undefined;
  }
}

type InitializeOutcome =
  | { ok: true; authorizationUrl: string }
  | { ok: false; reason: "not_configured" | "rejected" | "upstream" };

async function initializePaystackTransaction(input: {
  email: string;
  amountInPesewas: number;
  reference: string;
  metadata: Record<string, string | number>;
}): Promise<InitializeOutcome> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  // A missing key is a deployment problem, not something a buyer can act on:
  // loud in the log, neutral in the response.
  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is not configured; cannot initialize a transaction");
    return { ok: false, reason: "not_configured" };
  }

  // Paystack rejects a zero or negative amount, and a free event has no
  // transaction to initialize. Refusing here avoids creating a reference for an
  // order that can never be paid.
  if (!Number.isInteger(input.amountInPesewas) || input.amountInPesewas < 1) {
    return { ok: false, reason: "rejected" };
  }

  const callbackUrl = await resolveCallbackUrl();

  let response: Response;
  try {
    response = await fetch(PAYSTACK_INITIALIZE_URL, {
      method: "POST",
      headers: {
        // Server-to-server bearer auth. The key is read here, never leaves this
        // function, and is never part of the action's return value.
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        // Paystack expects the amount in the currency's subunit, which for GHS
        // is the pesewa. The webhook compares this settled integer against
        // Order.amountInPesewas.
        amount: input.amountInPesewas,
        currency: CURRENCY,
        reference: input.reference,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        metadata: input.metadata,
      }),
      // A hung request would hold both a reservation and a server worker open.
      signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Paystack initialize request failed", { error });
    return { ok: false, reason: "upstream" };
  }

  if (!response.ok) {
    console.error("Paystack initialize returned a non-2xx status", { status: response.status });
    return { ok: false, reason: "upstream" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "upstream" };
  }

  // ---- validate the upstream payload --------------------------------------
  const parsed = paystackInitializeResponseSchema.safeParse(body);

  if (!parsed.success) {
    console.error("Paystack initialize payload failed validation", parsed.error.issues);
    return { ok: false, reason: "rejected" };
  }

  if (!parsed.data.status) {
    console.error("Paystack initialize reported status:false", {
      message: parsed.data.message,
    });
    return { ok: false, reason: "rejected" };
  }

  return { ok: true, authorizationUrl: parsed.data.data.authorization_url };
}

/**
 * The absolute URL Paystack returns the buyer to. `NEXTAUTH_URL` is preferred
 * because it is configuration the operator controls. The `Host` header is only a
 * fallback, is restricted to https (plain http allowed on loopback for dev),
 * and is dropped entirely if it does not yield a usable origin — leaving
 * Paystack on its dashboard default is always better than trusting a header
 * that a proxy may have rewritten.
 */
async function resolveCallbackUrl(): Promise<string | null> {
  const configured = process.env.NEXTAUTH_URL ?? process.env.APP_URL;
  if (configured) {
    const fromConfig = withCallbackPath(configured);
    if (fromConfig) return fromConfig;
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return null;

  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  if (protocol !== "https" && protocol !== "http") return null;

  if (protocol !== "https" && !isLoopbackHostHeader(host)) return null;

  return withCallbackPath(`${protocol}://${host}`);
}

function withCallbackPath(base: string): string | null {
  try {
    const url = new URL(CALLBACK_PATH, base);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && isLoopbackHostname(url.hostname)) return url.toString();
    return null;
  } catch {
    return null;
  }
}

/** `hostname` as produced by `URL`, i.e. already stripped of any port. */
function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** The same test for a raw `Host` header, which may still carry a port. */
function isLoopbackHostHeader(host: string): boolean {
  return isLoopbackHostname(host) || /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
}

/**
 * The gate on step 6. This URL is about to be handed to `location.assign` in the
 * browser, which makes it a navigation target and therefore somewhere an
 * attacker would like to inject. https only, and only a host Paystack owns.
 */
function isTrustedCheckoutUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && ALLOWED_CHECKOUT_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
}

/** Host only, for a log line. Never log the full URL, and never the secret key. */
function hostOf(candidate: string): string | null {
  try {
    return new URL(candidate).hostname;
  } catch {
    return null;
  }
}

/**
 * Give the held seats back. A failure here is logged and swallowed: the buyer is
 * already being told the payment did not start, and rethrowing would replace
 * that message with a generic one and hide the original cause. The operator has
 * the reference in the log to reconcile the hold.
 */
async function releaseQuietly(reference: string): Promise<void> {
  try {
    await failOrderAndReleaseStock(reference);
  } catch (error) {
    if (!(error instanceof OrderError && error.code === "ALREADY_PROCESSED")) {
      console.error("Failed to release a reserved ticket hold", { reference }, error);
    }
  }
}

/**
 * `createPendingOrder` reports a rejected purchase as a typed error rather than
 * a generic failure, and each code maps to a message the buyer can act on. The
 * stock messages deliberately name the conflict instead of suggesting a retry
 * that would fail the same way.
 */
function fromOrderError(error: unknown): InitializePaymentResult {
  if (!(error instanceof OrderError)) {
    console.error("Unexpected error while reserving tickets", error);
    return {
      success: false,
      code: "PAYSTACK_UNAVAILABLE",
      error: "We could not reserve your tickets. Please try again.",
    };
  }

  switch (error.code) {
    case "NOT_FOUND":
      return { success: false, code: "NOT_FOUND", error: "That event is no longer available." };
    case "SOLD_OUT":
      return {
        success: false,
        code: "SOLD_OUT",
        error: "Not enough tickets left for that quantity. Please lower the number and try again.",
      };
    case "CONFLICT":
      return {
        success: false,
        code: "CONFLICT",
        error: "Tickets sold out while you were checking out. Please try again.",
      };
    default:
      return { success: false, code: "INVALID_INPUT", error: error.message };
  }
}
