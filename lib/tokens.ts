import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

// DECISION: the QR token is a v4 UUID rather than 32 random bytes in base64url.
// The token is a single-admission bearer credential, and a UUID is the required
// format: 122 bits of randomness is still unguessable, and a fixed-width
// 36-character token encodes into a QR code more reliably than a 43-character
// base64url string.
export function generateQrCodeToken(): string {
  return randomUUID();
}

export function generatePaystackReference(): string {
  return `evt_${randomBytes(12).toString("hex")}`;
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
