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
        className={cn("bg-primary h-full w-full flex-1", indicatorClassName)}
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </div>
  );
}

export { Progress };
