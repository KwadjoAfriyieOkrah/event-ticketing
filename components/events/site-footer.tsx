export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>EventHub — ticketing for events across Ghana.</p>
        <p>Payments are processed by Paystack. Tickets are issued as single-use QR codes.</p>
      </div>
    </footer>
  );
}
