"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Minus, Plus, TriangleAlert } from "lucide-react";

import { initializePayment } from "@/actions/initialize-payment";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPesewas } from "@/lib/utils";

/**
 * The buyer's side of checkout.
 *
 * It sends intent only — which event, how many, who for. It never sends an
 * amount: the price is read from the database by the Server Action, so a
 * tampered request cannot change what is charged. The action returns a URL that
 * has already been validated as an https Paystack checkout, and the only thing
 * this component does with it is navigate.
 */
export function CheckoutForm({
  eventId,
  unitPriceInPesewas,
  maxQuantity,
}: {
  eventId: string;
  unitPriceInPesewas: number;
  /** Capped by the server: the lower of the per-order limit and what is left. */
  maxQuantity: number;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Set once a redirect has been issued. The action has done its work and the
  // page is on its way out, so the form is locked rather than left submittable.
  const [redirecting, setRedirecting] = useState(false);
  const busy = isPending || redirecting;

  const totalInPesewas = unitPriceInPesewas * quantity;

  function adjust(delta: number) {
    setQuantity((current) => Math.min(maxQuantity, Math.max(1, current + delta)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await initializePayment({ eventId, fullName, email, quantity });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setRedirecting(true);

      // A full-page navigation, not a router push: the target is an off-origin
      // Paystack checkout, and `location.assign` is the only thing that leaves
      // the app cleanly. The URL was allowlisted against
      // checkout.paystack.com on the server before it was ever returned here.
      window.location.assign(result.authorizationUrl);
    });
  }

  if (unitPriceInPesewas === 0) {
    // There is no payable amount, so there is no Paystack transaction to
    // initialize. Saying so is better than rendering a button that can only fail.
    return (
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertDescription>
          This is a free event, so there is nothing to pay. Contact the organizer to register.
        </AlertDescription>
      </Alert>
    );
  }

  if (maxQuantity === 0) {
    return (
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertDescription>
          Every ticket for this event has been claimed. Returns do release held seats, so it is
          worth checking back.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Name on ticket</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={busy}
          placeholder="Ada Lovelace"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email for your ticket</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          placeholder="you@example.com"
        />
        <p className="text-muted-foreground text-xs">Paystack sends the receipt here.</p>
      </div>

      {/* A stepper has no input to label, so the group carries the name and the
          live value is announced through the output element instead. */}
      <div role="group" aria-labelledby="ticket-quantity-label" className="space-y-2">
        <span id="ticket-quantity-label" className="text-sm leading-none font-medium">
          Tickets
        </span>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="One fewer ticket"
            disabled={busy || quantity <= 1}
            onClick={() => adjust(-1)}
          >
            <Minus aria-hidden />
          </Button>

          <output aria-live="polite" className="w-10 text-center text-lg font-semibold tabular-nums">
            {quantity}
          </output>

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="One more ticket"
            disabled={busy || quantity >= maxQuantity}
            onClick={() => adjust(1)}
          >
            <Plus aria-hidden />
          </Button>

          <p className="text-muted-foreground ml-auto text-xs tabular-nums">
            {maxQuantity} max per order
          </p>
        </div>
      </div>

      <div className="bg-muted flex items-baseline justify-between rounded-md border px-3 py-2.5">
        <span className="text-sm font-medium">Total</span>
        <span className="text-lg font-semibold tabular-nums">{formatPesewas(totalInPesewas)}</span>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            {redirecting ? "Opening Paystack…" : "Starting checkout…"}
          </>
        ) : (
          "Pay and get tickets"
        )}
      </Button>

      <p className="text-muted-foreground text-center text-xs text-pretty">
        You will be taken to Paystack to pay. Tickets are issued once the payment settles.
      </p>
    </form>
  );
}
