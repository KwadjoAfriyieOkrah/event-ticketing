import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * DECISION: the cedi is subdivided into pesewas, and every amount in this app is
 * stored and transacted as an integer number of pesewas. Formatting happens only
 * at the edges (display), never for arithmetic, so a rounding difference can
 * never reach Paystack or the webhook's amount check.
 */
const PESEWAS_PER_CEDI = 100;

const cediFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPesewas(amountInPesewas: number): string {
  return cediFormatter.format(amountInPesewas / PESEWAS_PER_CEDI);
}

/**
 * DECISION: every event time is rendered in the venue's own timezone rather than
 * the viewer's. An event is a physical gathering at a fixed local time, so
 * showing a Ghanaian event in a UTC browser would misstate when the doors open.
 * The fixed locale also keeps the server HTML and the client hydration identical.
 */
const EVENT_TIME_ZONE = "Africa/Accra";

const eventDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: EVENT_TIME_ZONE,
});

export function formatEventDateTime(date: Date): string {
  return eventDateTimeFormatter.format(date);
}

/** Split date parts for the calendar block on a card. */
export function eventDateParts(date: Date): { day: string; month: string } {
  return {
    day: new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: EVENT_TIME_ZONE }).format(date),
    month: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: EVENT_TIME_ZONE }).format(date),
  };
}
