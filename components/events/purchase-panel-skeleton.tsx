import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors `PurchasePanel`'s box model: title block, the counter, then the form
 * fields. The panel is the page's first dynamic zone, so its skeleton is the
 * first thing a buyer sees on a cold load and has to be dimensionally honest
 * or the sticky column jumps when the real panel arrives.
 */
export function PurchasePanelSkeleton() {
  return (
    <Card className="gap-6" aria-hidden>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-full" />
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-4 border-t">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </CardFooter>
    </Card>
  );
}
