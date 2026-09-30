"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type QrReaderProps = {
  onScan: (token: string) => void;
  onCameraError: (message: string) => void;
};

/**
 * Owns the html5-qrcode lifecycle. Loaded via next/dynamic with ssr:false from
 * the scanner so this module is only ever evaluated in a browser.
 */
export default function QrReader({ onScan, onCameraError }: QrReaderProps) {
  const [active, setActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // The library's onSuccess closure outlives renders, so read the callbacks
  // through refs instead of listing them as effect dependencies — otherwise
  // every parent render would tear down and restart the camera. The sync is an
  // effect rather than an assignment during render, which the react-hooks lint
  // rules require; it must be declared above the scanner effect so the refs are
  // populated before the camera can fire.
  const onScanRef = useRef(onScan);
  const onCameraErrorRef = useRef(onCameraError);

  useEffect(() => {
    onScanRef.current = onScan;
    onCameraErrorRef.current = onCameraError;
  });

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader", {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = scanner;

    let cancelled = false;

    void (async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            aspectRatio: 1,
            // Scale the reticle to the viewport so it is usable on a phone
            // without shrinking the scan area on a tablet.
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
              return { width: size, height: size };
            },
          },
          (decodedText) => onScanRef.current(decodedText),
          () => {
            // Called for every frame without a readable code. Swallowing it is
            // what lets the camera keep running between scans.
          },
        );

        if (!cancelled) setActive(true);
      } catch (error) {
        if (!cancelled) onCameraErrorRef.current(describeCameraError(error));
      }
    })();

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (!instance) return;

      // Leaving the camera stream open on unmount keeps the browser's recording
      // indicator lit, so the track has to be explicitly stopped.
      if (instance.isScanning) {
        void instance.stop().catch(() => {}).finally(() => instance.clear());
      } else {
        instance.clear();
      }
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-950">
      {/* id is required by html5-qrcode, which looks the element up by id. */}
      <div id="qr-reader" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {!active && (
        <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">
          Starting camera…
        </div>
      )}
    </div>
  );
}

/**
 * Turns the opaque DOMException names getUserMedia throws into something a gate
 * agent can act on. Every branch ends with the manual-entry fallback, because a
 * phone that refuses the camera must not be a dead end at the door.
 */
function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera scanning needs HTTPS. Enter the code by hand below.";
  }
  if (name === "NotAllowedError" || /permission|notallowed/i.test(message)) {
    return "Camera access was blocked. Allow the camera for this site, then reload — or enter the code by hand below.";
  }
  if (name === "NotFoundError" || /notfound|no camera|requested device/i.test(message)) {
    return "No camera found on this device. Enter the code by hand below.";
  }
  if (name === "NotReadableError" || /notreadable|being used/i.test(message)) {
    return "The camera is already in use by another app. Close it and reload, or enter the code by hand below.";
  }

  return "The camera could not be started. Enter the code by hand below.";
}
