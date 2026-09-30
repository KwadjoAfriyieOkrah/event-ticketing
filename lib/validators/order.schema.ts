import { z } from "zod";

/**
 * The shape of the reference this app hands to Paystack, which comes back on the
 * callback URL and is the only thing that identifies the order to the buyer.
 *
 * Validating it before the database is queried is not just tidiness: an
 * unbounded attacker-supplied string becomes a `findUnique` on a unique index
 * with an arbitrary length, and there is no reason to spend a round trip on input
 * that cannot possibly match. The bound is a hard maximum rather than
 * `.max(N)` alone so a megabyte-long query string is rejected during parsing.
 *
 * `evt_` plus 12 bytes of hex is the format produced by `generatePaystackReference`
 * in lib/tokens.ts. It is 96 bits of randomness, so this check exists to keep
 * junk out of the query, not to make guessing infeasible.
 */
const REFERENCE_PATTERN = /^evt_[0-9a-f]{24}$/;

export const MAX_REFERENCE_LENGTH = 64;

export function parsePaystackReference(input: unknown): string | null {
  if (typeof input !== "string") return null;

  // Paystack mirrors the reference in `trxref` uppercased, and a proxy or a
  // hand-edited link may pad it, so normalise before matching. `paystackReference`
  // is stored lowercase by createPendingOrder.
  const normalized = input.trim().toLowerCase();

  if (normalized.length === 0 || normalized.length > MAX_REFERENCE_LENGTH) return null;
  if (!REFERENCE_PATTERN.test(normalized)) return null;

  return normalized;
}

/**
 * The query parameter names Paystack appends to the callback URL. Paystack sends
 * both `reference` (as submitted) and `trxref` (uppercased); `reference` is
 * preferred, with `trxref` as the fallback so the page still works if only that
 * one survives a redirect chain.
 */
export function referenceFromSearchParams(params: Record<string, string | string[] | undefined>): string | null {
  for (const key of ["reference", "trxref"] as const) {
    const raw = params[key];
    const candidate = Array.isArray(raw) ? raw[0] : raw;
    const parsed = parsePaystackReference(candidate);
    if (parsed) return parsed;
  }

  return null;
}

/** Zod wrapper, for callers that prefer schema validation to a parse function. */
export const paystackReferenceSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_REFERENCE_LENGTH)
  .regex(REFERENCE_PATTERN, "That payment reference is not valid.");
