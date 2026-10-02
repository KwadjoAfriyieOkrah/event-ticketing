"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CameraOff, Check, Keyboard, ScanLine, X } from "lucide-react";

import { validateTicket, type ScanResult } from "@/lib/actions/validate-ticket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// html5-qrcode touches window at import time, so it must never be pulled into
// the server render.
const QrReader = dynamic(() => import("@/components/scan/qr-reader"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse rounded-2xl bg-zinc-900" />,
});

const RESULT_HOLD_MS = 3500;
const DUPLICATE_SCORE_GUARD_MS = 2000;

type Tone = "admit" | "deny" | "neutral";

function toneFor(outcome: ScanResult["outcome"]): Tone {
  if (outcome === "ADMITTED") return "admit";
  if (outcome === "UNAUTHORIZED" || outcome === "RATE_LIMITED" || outcome === "INVALID") return "neutral";
  return "deny";
}

const HEADLINES: Record<ScanResult["outcome"], string> = {
  ADMITTED: "ADMIT",
  ALREADY_USED: "ALREADY SCANNED",
  NOT_FOUND: "TICKET NOT FOUND",
  PENDING: "PAYMENT NOT CONFIRMED",
  VOID: "VOID TICKET",
  EXPIRED: "EXPIRED TICKET",
  UNAUTHORIZED: "SIGN IN REQUIRED",
  RATE_LIMITED: "TOO MANY SCANS",
  INVALID: "UNREADABLE CODE",
};

export function TicketScanner({ operatorName }: { operatorName: string }) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [scanCount, setScanCount] = useState(0);

  // Guards against a second result overwriting the first while the first is
  // still on screen, and against the same ticket being re-scored on consecutive
  // frames before the overlay is dismissed.
  const busyRef = useRef(false);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);

  const submit = useCallback(async (token: string) => {
    if (busyRef.current) return;

    const now = Date.now();
    const previous = lastTokenRef.current;
    if (previous && previous.token === token && now - previous.at < DUPLICATE_SCORE_GUARD_MS) return;

    busyRef.current = true;
    lastTokenRef.current = { token, at: now };
    setBusy(true);

    try {
      const outcome = await validateTicket({ qrCodeToken: token });

      setResult(outcome);
      setScanCount((count) => count + 1);

      // A distinct haptic per outcome means staff can keep their eyes on the
      // queue and still know the result.
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(toneFor(outcome.outcome) === "admit" ? 120 : [90, 70, 90]);
      }
    } catch {
      setResult({
        outcome: "INVALID",
        eventTitle: null,
        holderName: null,
        at: null,
        message: "Could not reach the server",
      });
    } finally {
      setBusy(false);

      // Released on a timer rather than immediately so the camera cannot
      // re-score the same code while its result is still displayed.
      window.setTimeout(() => {
        busyRef.current = false;
      }, RESULT_HOLD_MS);
    }
  }, []);

  const dismiss = useCallback(() => {
    setResult(null);
    busyRef.current = false;
    lastTokenRef.current = null;
  }, []);

  useEffect(() => {
    if (!result) return;

    const tone = toneFor(result.outcome);
    if (tone === "neutral") return;

    const timer = window.setTimeout(dismiss, RESULT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [result, dismiss]);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-contain">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">Gate Scanner</h1>
          <p className="truncate text-sm text-muted-foreground">{operatorName}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 gap-1.5">
          <ScanLine className="size-3" />
          {scanCount} {scanCount === 1 ? "scan" : "scans"}
        </Badge>
      </header>

      <div className="relative">
        <QrReader onScan={(token) => void submit(token)} onCameraError={setCameraError} />
        <Reticle />
        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-zinc-950/70 text-sm font-medium text-white">
            Checking…
          </div>
        )}
      </div>

      {cameraError ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <CameraOff className="mt-0.5 size-4 shrink-0" />
          <span>{cameraError}</span>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Hold the ticket QR code inside the frame.
        </p>
      )}

      <Card>
        <CardHeader className="gap-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Keyboard className="size-4" />
            Manual entry
          </CardTitle>
          <CardDescription>
            Fallback for a damaged code, a refused camera, or a desktop browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const token = manualToken.trim();
              if (!token) return;
              setManualToken("");
              void submit(token);
            }}
          >
            <input
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              placeholder="Paste ticket code"
              aria-label="Ticket code"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 touch-manipulation rounded-md border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
            />
            <Button type="submit" size="lg" disabled={busy || manualToken.trim().length === 0}>
              Validate
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && toneFor(result.outcome) === "neutral" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-zinc-300 bg-zinc-100 p-3 text-sm text-zinc-800"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{result.message}</span>
        </div>
      )}

      {result && toneFor(result.outcome) !== "neutral" && (
        <FeedbackOverlay result={result} onDismiss={dismiss} />
      )}
    </div>
  );
}

const TONE_STYLES: Record<Exclude<Tone, "neutral">, { shell: string; ring: string }> = {
  admit: { shell: "bg-emerald-600", ring: "bg-white/25" },
  deny: { shell: "bg-red-600", ring: "bg-white/25" },
};

/**
 * Full-bleed decision card. Deliberately not dismissible by tapping: at a busy
 * gate a stray touch must not clear the result before the holder is processed.
 */
function FeedbackOverlay({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  const tone = toneFor(result.outcome) as Exclude<Tone, "neutral">;
  const admitted = result.outcome === "ADMITTED";
  const Icon = admitted ? Check : X;

  return (
    <div
      // assertive so a screen reader interrupts whatever it was saying.
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8 text-center text-white",
        TONE_STYLES[tone].shell,
      )}
    >
      <span
        className={cn(
          "grid size-28 place-items-center rounded-full ring-8 sm:size-32",
          TONE_STYLES[tone].ring,
        )}
      >
        <Icon className="size-16 stroke-[3] sm:size-20" />
      </span>

      <div className="space-y-2">
        <p className="text-3xl font-black tracking-tight sm:text-5xl">{HEADLINES[result.outcome]}</p>
        {result.eventTitle && (
          <p className="text-lg font-medium opacity-95 sm:text-2xl">{result.eventTitle}</p>
        )}
        {result.holderName && (
          <p className="text-base opacity-90 sm:text-xl">{result.holderName}</p>
        )}
      </div>

      {result.at && (
        <p className="text-sm font-medium tabular-nums opacity-90">
          {result.outcome === "ALREADY_USED" ? "First scanned " : "Scanned "}
          {new Date(result.at).toLocaleTimeString()}
        </p>
      )}

      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
        <div className="h-full w-full bg-white/90 animate-scan-shrink" />
      </div>

      <Button
        variant="secondary"
        size="lg"
        onClick={onDismiss}
        className="mt-2 h-12 bg-white px-8 text-base text-zinc-900 hover:bg-white/90"
      >
        Scan next
      </Button>
    </div>
  );
}

/** Corner brackets framing the scan area, drawn over the video. */
function Reticle() {
  const corner = "absolute size-10 border-[3px] border-white/90 rounded-[4px]";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-[14%]">
      <div className={cn(corner, "top-0 left-0 border-r-0 border-b-0")} />
      <div className={cn(corner, "top-0 right-0 border-b-0 border-l-0")} />
      <div className={cn(corner, "bottom-0 left-0 border-t-0 border-r-0")} />
      <div className={cn(corner, "right-0 bottom-0 border-t-0 border-l-0")} />
    </div>
  );
}
