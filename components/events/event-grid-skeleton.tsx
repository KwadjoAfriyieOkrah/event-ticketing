import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors `EventCard`'s box model so the grid does not reflow when the real
 * cards swap in. Kept as three cards rather than one, so the grid's own
 * `sm:grid-cols-2 lg:grid-cols-3` behaviour is visible while loading.
 */
export function EventGridSkeleton() {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="flex">
          <Card className="w-full gap-4 overflow-hidden py-0">            <Skeleton className="aspect-16/10 w-full rounded-none" />

            <CardHeader className="gap-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </CardHeader>

            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>

            <CardFooter className="justify-between border-t pt-4 [.border-t]:pt-4">
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}
