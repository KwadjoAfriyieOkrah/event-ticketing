"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * A single admission ticket's QR code.
 *
 * DECISION: encode the bare `qrCodeToken`, not a URL to this page. The gate
 * scanner hands the raw decoded text straight to `redeemTicket`, which looks the
 * token up on the unique index, so a URL would be rejected at the door. A ticket
 * that scans to a pretty link and admits nobody is worse than no ticket at all.
 *
 * DECISION: SVG rather than canvas. The payload is a 36-character UUID, and an
 * SVG viewBox scales losslessly to whatever the phone's camera is pointed at while
 * canvas would resample into a blurry blob. It also paints synchronously, so
 * there is no blank frame between hydration and first paint at the gate.
 *
 * A Client Component because `qrcode.react` is a React renderer. The token is
 * already in the HTML as the ticket's visible reference below the code, so
 * hydrating it on the client reveals nothing new.
 */
export function TicketQr({ token, size = 232 }: { token: string; size?: number }) {
  return (
    <div
      className="flex justify-center rounded-xl border bg-white p-4 shadow-sm"
      // The white backing is the quiet zone's final guarantee. `marginSize` adds
      // modules, but a gate scanner needs light pixels right up to the symbol's
      // edge, and a dark page background bleeding into the corners is enough to
      // defeat it.
    >
      <QRCodeSVG
        value={token}
        size={size}
        // M recovers ~15% of the symbol, which is generous headroom for a screen
        // held at an angle, and keeps the module count low for a short payload.
        level="M"
        // The QR spec's quiet zone is 4 modules. Two here plus the card padding
        // clears it without shrinking the modules at this size.
        marginSize={2}
        boostLevel
        bgColor="#ffffff"
        fgColor="#000000"
        // Scoped to the SVG, not the wrapper: this is the accessible name of the
        // symbol itself, and the wrapper keeps its own layout.
        className="h-auto max-w-full"
        title={`Ticket QR code ${token}`}
      />
    </div>
  );
}
