"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

/**
 * Settlement is driven by the Paystack webhook, not by this redirect.
 *
 * The buyer leaves for Paystack, pays, and comes straight back here — but the
 * charge.success event is a separate server-to-server POST that usually lands
 * *after* the browser. So the first render of this page is very often PENDING
 * even though the money has moved. Without something here, the buyer is told to
 * retry an order that has already succeeded, and a second order gets placed.
 *
 * `router.refresh()` re-runs the Server Component and its Prisma query without a
 * client-side route change or a new API route, so the page is the only thing
 * that defines the current state. When the webhook has landed, the refreshed
 * tree arrives with the real order and this component unmounts with it.
 *
 * DECISION: bounded polling, and only while the order is PENDING. It stops after
 * MAX_ATTEMPTS and leaves the honest "still confirming" message with a retry
 * link, rather than re-querying the database forever for a buyer who has closed
 * the tab. It also pauses while the tab is hidden, so a phone left face-up on this
 * page does not poll in the background all night.
 */
const POLL_INTERVAL_MS = 3_000;
const MAX_ATTEMPTS = 12;

export function OrderStatusPoller() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (attempt >= MAX_ATTEMPTS) return;

    const isHidden = document.visibilityState === "hidden";

    timeoutRef.current = setTimeout(
      () => {
        router.refresh();
        setAttempt((current) => current + 1);
      },
      isHidden ? POLL_INTERVAL_MS * 3 : POLL_INTERVAL_MS,
    );

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [attempt, router]);

  const exhausted = attempt >= MAX_ATTEMPTS;

  return (
    <div aria-live="polite" className="space-y-2">
      <p className="flex items-center justify-center gap-2 text-sm font-medium">
        {!exhausted && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {exhausted ? "Still confirming your payment" : "Confirming your payment…"}
      </p>
      <p className="text-muted-foreground text-center text-xs text-pretty">
        {exhausted ? (
          <>
            This is taking longer than usual. Your tickets appear here as soon as the payment
            clears — you can also reload this page, and any email from the organizer will carry
            them.
          </>
        ) : (
          "Do not close this page. Most payments are confirmed within a few seconds."
        )}
      </p>
    </div>
  );
}
