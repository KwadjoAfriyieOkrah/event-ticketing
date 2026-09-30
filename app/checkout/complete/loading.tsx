import { SiteFooter } from "@/components/events/site-footer";
import { SiteHeader } from "@/components/events/site-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streamed while the order lookup runs. The header and footer paint immediately
 * and the card fills in, so the buyer lands on a finished-looking page rather than
 * a blank one — which matters here because the common case is a PENDING order
 * that they are watching for a status change on.
 */
export default function CheckoutCompleteLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <div className="space-y-3 text-center">
              <Skeleton className="mx-auto size-14 rounded-full" />
              <Skeleton className="mx-auto h-9 w-72" />
              <Skeleton className="mx-auto h-4 w-full max-w-md" />
            </div>

            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Skeleton className="aspect-square w-full shrink-0 rounded-lg sm:w-28" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
                <div className="space-y-2 rounded-lg p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mx-auto size-56 rounded-xl" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
