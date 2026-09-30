import { CalendarDays } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md">
            <CalendarDays className="size-4" aria-hidden />
          </span>
          <span className="tracking-tight">EventHub</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/#events"
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 font-medium transition-colors"
          >
            Events
          </Link>
          <Link
            href="/#how-it-works"
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 font-medium transition-colors"
          >
            How it works
          </Link>
        </nav>
      </div>
    </header>
  );
}
