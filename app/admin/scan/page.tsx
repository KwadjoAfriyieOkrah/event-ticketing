import { redirect } from "next/navigation";

import { TicketScanner } from "@/components/scan/ticket-scanner";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Gate scanner. The route is already gated by proxy.ts, but the check is
 * repeated here so the page is safe even if the matcher changes, and so the
 * client never renders for an unauthenticated admin. Matches the pattern in
 * admin/events/page.tsx.
 */
export default async function ScanPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin/login?callbackUrl=/admin/scan");
  }

  // The `light` scope opts this one route back out of the dark base palette.
  // This is a phone held outdoors at a doorway in direct sunlight, where the
  // dark canvas is genuinely harder to read, and where the admit/deny decision
  // has to stay unambiguous against whatever the gate is doing behind it. It is
  // pinned rather than left to `prefers-color-scheme` because these are shared
  // staff devices — the operator's personal phone theme is not a decision about
  // how the gate screen should be lit.
  //
  // `min-h-dvh` + `flex-1` so the scope always paints the full viewport and the
  // dark body canvas behind it never shows through a short page.
  return (
    <div className="light flex min-h-dvh flex-1 flex-col">
      <TicketScanner operatorName={session.user.name ?? session.user.email ?? "Gate staff"} />
    </div>
  );
}
