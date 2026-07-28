import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const connectSources = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
  ...(isProduction
    ? []
    : [
        "http://localhost:*",
        "http://127.0.0.1:*",
        "ws://localhost:*",
        "ws://127.0.0.1:*",
      ]),
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://maps.googleapis.com https://maps.gstatic.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${connectSources}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
