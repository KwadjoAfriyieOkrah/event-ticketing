import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Event artwork is a free-text URL supplied by the organizer, so the
    // hostname cannot be known ahead of time. Rather than optimizing it, the
    // public cards render with `unoptimized`, which keeps the image optimizer
    // from being turned into a server-side fetch proxy for arbitrary hosts.
    // The `img-src` directive in the CSP below is the actual allowlist, and
    // https-only keeps a plaintext or scheme-relative URL out.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://checkout.paystack.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // blob: is required for the camera stream and html5-qrcode's
              // worker, both of which are blob URLs rather than network ones.
              "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.paystack.co https://api.cloudinary.com",
              "frame-src 'self' https://checkout.paystack.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.paystack.com",
              "upgrade-insecure-requests"
            ].join("; ")
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          }
        ]
      },
      {
        // DECISION: the site-wide rule above denies the camera everywhere. The
        // gate scanner is the one route that needs it, so this later, more
        // specific rule re-permits the camera for that path only. Next applies
        // matching header rules in order, so this one overrides the general
        // `camera=()` for /admin/scan and leaves every other page locked down.
        source: "/admin/scan",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()"
          }
        ]
      },
      {
        // DECISION: the checkout completion URL carries the Paystack reference,
        // which is the only credential a guest buyer has. The site-wide rule
        // above sends the full URL, including its query string, on same-origin
        // requests, so the reference would otherwise be written into this app's
        // own access logs for every JS chunk and stylesheet the page pulls.
        // `no-referrer` drops it entirely. Kept as a header rather than a
        // `<meta name="referrer">`, because an HTTP header overrides the meta tag
        // and the meta would be silently inert.
        source: "/checkout/complete",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
