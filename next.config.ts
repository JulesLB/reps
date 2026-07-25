import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Supabase keeps the access *and refresh* token in localStorage, so any script
 * that runs on this origin owns the account rather than one session. Nothing in
 * the app injects HTML today, so this is the belt to React's braces.
 *
 * Nonces are the stricter option but force every page to render dynamically
 * (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md),
 * which is the wrong trade for an offline-first PWA that is entirely static.
 * 'unsafe-inline' on script-src is the cost of that choice; connect-src carries
 * the weight here, since a stolen token still has to be sent somewhere.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
