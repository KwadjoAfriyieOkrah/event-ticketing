import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A dependency-free progress bar. `value` is a percentage and is clamped here
 * rather than trusted, so a sold-out or over-capacity event can never render a
 * bar that overflows its track.
 */
function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<"div"> & { value?: number; indicatorClassName?: string }) {
  const percent =
    typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cn("bg-secondary relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        // Wine ramp rather than a flat fill: the gradient starts on the accent
        // step, which is the one wine that clears 3:1 against this track, so the
        // leading edge — the part that shows how much is left — is the readable
        // end.
        //
        // A caller overrides the *stops*, never the whole gradient. `bg-*` on
        // the caller's side would be a background-colour while this is a
        // background-image, so tailwind-merge keeps both and the wine gradient
        // silently paints over whatever state colour was passed.
        className={cn(
          "bg-linear-to-r from-brand-accent to-primary h-full w-full flex-1",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </div>
  );
}

export { Progress };
