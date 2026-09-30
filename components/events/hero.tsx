import { CalendarDays, ShieldCheck, Ticket } from "lucide-react";

const PROMISES = [
  {
    icon: Ticket,
    title: "Instant QR tickets",
    body: "Your ticket and its scannable code are issued the moment payment settles.",
  },
  {
    icon: ShieldCheck,
    title: "Verified entry",
    body: "Every code is single-use and signed, so a duplicated ticket cannot get in twice.",
  },
  {
    icon: CalendarDays,
    title: "One calendar",
    body: "Concerts, tech summits and workshops across Ghana, all in one place.",
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      {/* A single soft gradient wash. Kept as one element rather than a stack of
          blurred blobs so the hero costs one paint instead of four. The colour
          comes from `--hero-glow` so the wash follows the palette instead of
          hard-coding a violet that would not survive a rebrand. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_50%_0%,var(--hero-glow)_0%,transparent_100%)]"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="border-primary/30 bg-primary/10 text-brand inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <span className="bg-success size-1.5 rounded-full" aria-hidden />
            Tickets are live for this season
          </p>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Find your next event.
            {/* Gradient-clipped rather than a flat colour so the accent reads as
                the one radiant element on the page without introducing a second
                hue. Both stops are AA-legible against the canvas, so the line
                survives being read rather than only being looked at. */}
            <span className="from-primary to-brand block bg-linear-to-r bg-clip-text text-balance text-transparent">
              Be in the room for it.
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty">
            Browse what is on across Ghana, see exactly how many tickets are left, and pay
            securely by card or mobile money. Your QR ticket lands in your inbox.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#events"
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 focus-visible:ring-[3px] inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-6 text-sm font-medium shadow-xs transition-colors sm:w-auto"
            >
              Browse upcoming events
            </a>
            <a
              href="#how-it-works"
              className="border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-6 text-sm font-medium shadow-xs transition-colors sm:w-auto"
            >
              How ticketing works
            </a>
          </div>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="bg-card border-border hover:border-primary/40 flex flex-col gap-2 rounded-xl border p-5 transition-colors"
            >
              <span className="bg-primary/10 text-brand grid size-9 place-items-center rounded-md">
                <Icon className="size-4" aria-hidden />
              </span>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="text-muted-foreground text-sm text-pretty">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
