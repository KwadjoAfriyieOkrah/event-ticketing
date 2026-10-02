import { CalendarDays } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="max-w-md text-center">
          <CalendarDays className="text-muted-foreground mx-auto size-10" aria-hidden />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">We could not find that page</h1>
          <p className="text-muted-foreground mt-3 text-pretty">
            The event may have been removed, or the link may be wrong. Everything currently on sale
            is on the events page.
          </p>
          <Link
            href="/#events"
            className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 inline-flex h-10 items-center justify-center rounded-md px-6 text-sm font-medium transition-colors"
          >
            Browse upcoming events
          </Link>
        </div>
      </main>
    </div>
  );
}
