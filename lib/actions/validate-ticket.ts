"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { redeemTicket } from "@/lib/orders";

/**
 * The scanner only ever sends a v4 UUID (see generateQrCodeToken), but the
 * character class is kept wide so a ticket minted under an older token format
 * still scans. The length cap is what stops a huge pasted string reaching the
 * database at all.
 */
const scanInputSchema = z.strictObject({
  qrCodeToken: z.string().trim().min(1).max(200),
});

export type ScanResult = {
  outcome:
    | "ADMITTED"
    | "ALREADY_USED"
    | "NOT_FOUND"
    | "PENDING"
    | "VOID"
    | "EXPIRED"
    | "UNAUTHORIZED"
    | "RATE_LIMITED"
    | "INVALID";
  eventTitle: string | null;
  holderName: string | null;
  /** This scan's timestamp, or the original scan's when ALREADY_USED. */
  at: string | null;
  message: string;
};

/**
 * A gate lane scanning faster than this is a mistake, not a customer. The cap
 * is generous for burst scanning but bounds how hard a stolen session can grind
 * the database from a compromised admin device.
 */
const MAX_SCANS_PER_MINUTE = 60;

/**
 * Why this file duplicates the admin check instead of importing requireAdmin()
 * from "@/lib/require-admin": Next only allows "use server" modules to export
 * async functions, so the shared guard (which also exports `unauthorized` and
 * `badRequest` Response factories) cannot be re-exported from here. This is
 * the same pattern already used in event.actions.ts.
 *
 * DECISION: the spec asked for requireRole("ADMIN"). This codebase has no such
 * helper; requireAdmin() is the established guard and is what protects the
 * rest of the admin surface, so this uses it rather than introducing a second
 * name for the same check.
 */
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") return null;

  return session;
}

function failure(outcome: ScanResult["outcome"], message: string, at: string | null = null): ScanResult {
  return { outcome, eventTitle: null, holderName: null, at, message };
}

/**
 * Redeems one scanned ticket. Authorisation, rate limiting and validation all
 * happen before the database is touched; the only write is the ISSUED -> USED
 * compare-and-swap inside redeemTicket's transaction.
 */
export async function validateTicket(raw: unknown): Promise<ScanResult> {
  const session = await requireAdmin();
  if (!session) {
    return failure("UNAUTHORIZED", "Sign in to validate tickets");
  }

  const limit = rateLimit(`scan:${session.user.id}`, MAX_SCANS_PER_MINUTE, 60_000);
  if (!limit.success) {
    return failure("RATE_LIMITED", "Too many scans. Pause for a moment.");
  }

  const parsed = scanInputSchema.safeParse(raw);

  if (!parsed.success) {
    return failure("INVALID", "Unreadable code");
  }

  const { qrCodeToken } = parsed.data;
  const result = await redeemTicket(qrCodeToken);

  switch (result.outcome) {
    case "ADMITTED":
      revalidatePath("/admin/scan");
      return {
        outcome: "ADMITTED",
        eventTitle: result.eventTitle,
        holderName: result.holderName,
        at: (result.scannedAt ?? new Date()).toISOString(),
        message: "Admit",
      };

    case "ALREADY_USED":
      return {
        outcome: "ALREADY_USED",
        eventTitle: result.eventTitle,
        holderName: result.holderName,
        at: (result.usedAt ?? new Date()).toISOString(),
        message: "Already scanned",
      };

    case "PENDING":
      return {
        outcome: "PENDING",
        eventTitle: result.eventTitle,
        holderName: result.holderName,
        at: null,
        message: "Payment not confirmed",
      };

    case "VOID":
      return {
        outcome: "VOID",
        eventTitle: result.eventTitle,
        holderName: result.holderName,
        at: null,
        message: "Voided ticket",
      };

    case "EXPIRED":
      return {
        outcome: "EXPIRED",
        eventTitle: result.eventTitle,
        holderName: result.holderName,
        at: null,
        message: "Expired ticket",
      };

    case "NOT_FOUND":
      return failure("NOT_FOUND", "Ticket not found");
  }
}
