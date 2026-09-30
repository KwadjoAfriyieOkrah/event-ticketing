import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EventHub — tickets for events across Ghana",
    template: "%s",
  },
  description:
    "Browse upcoming concerts, summits and workshops, see live ticket availability, and pay securely by card or mobile money.",
};

/**
 * The base palette is dark, so the browser chrome has to be told — otherwise a
 * light address bar sits above a near-black canvas and a white overscroll
 * flashes on pull-to-refresh. `color-scheme` here is the document default; the
 * gate scanner overrides it per-subtree with the `.light` scope in globals.css,
 * which is what its form controls and scrollbars follow.
 */
export const viewport: Viewport = {
  themeColor: "#0b0f17",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
