import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";

import { OrderError, failOrderAndReleaseStock, markOrderPaidAndIssueTickets } from "@/lib/orders";
import { safeCompare } from "@/lib/tokens";
import { paystackChargeSuccessSchema, paystackWebhookSchema } from "@/lib/validators/paystack.schema";

const SIGNATURE_HEADER = "x-paystack-signature";
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;

  if (!secret) {
    console.error("PAYSTACK_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const providedSignature = request.headers.get(SIGNATURE_HEADER);

  if (!providedSignature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // Charge payloads are well under a kilobyte. Reject an oversized body from
  // the declared length before buffering it, so an unauthenticated caller
  // cannot use this endpoint to exhaust memory.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Paystack signs the exact bytes it sent. The body is read once as text and
  // reused: re-serialising the parsed JSON would change key order and
  // whitespace, and the digest would never match. Nothing is parsed, and no
  // database is touched, until this check has passed.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Unreadable request body" }, { status: 400 });
  }

  if (rawBody.length === 0) {
    return NextResponse.json({ error: "Empty request body" }, { status: 400 });
  }

  // Paystack signs with HMAC-SHA512 and sends a lowercase hex digest.
  const expectedSignature = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");

  if (!safeCompare(expectedSignature, providedSignature)) {
    console.error("Paystack webhook rejected: signature mismatch");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = paystackWebhookSchema.safeParse(payload);

  if (!parsed.success) {
    console.error("Paystack webhook payload failed validation", parsed.error.issues);
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const { event, data } = parsed.data;

  if (event === "charge.success") {
    return handleChargeSuccess(data);
  }

  if (event === "charge.failed") {
    return handleChargeFailed(data.reference);
  }

  // Acknowledge anything else with a 200 so Paystack stops redelivering
  // events this app has no interest in.
  return NextResponse.json({ received: true, ignored: event });
}

async function handleChargeSuccess(data: unknown): Promise<NextResponse> {
  const charge = paystackChargeSuccessSchema.safeParse(data);

  if (!charge.success) {
    console.error("charge.success missing settlement fields", charge.error.issues);
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (charge.data.status !== "success") {
    console.error("charge.success arrived with a non-success status", {
      reference: charge.data.reference,
      status: charge.data.status,
    });
    return NextResponse.json({ error: "Charge was not successful" }, { status: 400 });
  }

  try {
    const settled = await markOrderPaidAndIssueTickets({
      paystackReference: charge.data.reference,
      amountInPesewas: charge.data.amount,
      currency: charge.data.currency,
    });

    return NextResponse.json({ received: true, ...settled });
  } catch (error) {
    return toErrorResponse(error, charge.data.reference, "settle");
  }
}

async function handleChargeFailed(reference: string): Promise<NextResponse> {
  try {
    const released = await failOrderAndReleaseStock(reference);

    return NextResponse.json({ received: true, ...released });
  } catch (error) {
    return toErrorResponse(error, reference, "release");
  }
}

function toErrorResponse(error: unknown, reference: string, action: string): NextResponse {
  if (error instanceof OrderError) {
    // Paystack redelivers a webhook when the response is not a 2xx. A repeat
    // delivery of an order that is already settled is a success from
    // Paystack's point of view, so acknowledge it and stop the retries.
    if (error.code === "ALREADY_PROCESSED") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (error.code === "NOT_FOUND") {
      console.error(`Paystack webhook: no order found to ${action}`, { reference });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
  }

  // Anything else — an oversold event, an amount or currency mismatch, a lost
  // connection — leaves the transaction rolled back with no tickets issued.
  // The charge is real, so answer 500 and let Paystack retry, while the detail
  // is logged for an operator to reconcile.
  const detail = error instanceof OrderError ? { code: error.code, message: error.message } : error;
  console.error(`Paystack webhook failed to ${action}`, { reference }, detail);

  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
