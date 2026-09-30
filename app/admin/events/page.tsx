import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { eventStats, getAllEventsForAdmin } from "@/lib/data/events";

export const dynamic = "force-dynamic";

function formatPesewas(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

export default async function Page() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }

  const events = await getAllEventsForAdmin();

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Admin Events</h1>

      {events.length === 0 ? (
        <div className="text-muted-foreground">
          No events yet.{" "}
          <a href="/admin/events/new" className="text-brand hover:underline">
            Create the first one
          </a>
          .
        </div>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="divide-border min-w-full divide-y">
              <thead className="bg-muted">
                <tr>
                  <th className="text-muted-foreground p-4 text-left font-semibold">Title</th>
                  <th className="text-muted-foreground p-4 text-left font-semibold">Date</th>
                  <th className="text-muted-foreground p-4 text-left font-semibold">Mode</th>
                  <th className="text-muted-foreground p-4 text-left font-semibold">Tickets Sold</th>
                  <th className="text-muted-foreground p-4 text-left font-semibold">Capacity</th>
                  <th className="text-muted-foreground p-4 text-left font-semibold">
                    Revenue (GHS)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {events.map((event) => {
                  const stats = eventStats(event);

                  return (
                    <tr key={event.id} className="hover:bg-accent/50 transition-colors">
                      <td className="p-4 font-medium">{event.title}</td>
                      <td className="text-muted-foreground p-4 tabular-nums">
                        {new Date(event.eventDate).toLocaleDateString()}
                      </td>
                      <td className="text-muted-foreground p-4">{event.mode}</td>
                      <td className="p-4 tabular-nums">
                        {stats.ticketsSold}
                        {stats.soldOut ? (
                          <span className="bg-destructive/10 text-destructive ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
                            SOLD OUT
                          </span>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground p-4 tabular-nums">
                        {stats.capacity == null ? "Unlimited" : stats.capacity}
                      </td>
                      <td className="p-4 tabular-nums">{formatPesewas(stats.revenueInPesewas)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <a
          href="/admin/events/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors"
        >
          New Event
        </a>
      </div>
    </div>
  );
}
