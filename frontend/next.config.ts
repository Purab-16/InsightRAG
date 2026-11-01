import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origin of a configured URL, or null when it is missing or invalid (so CSP never gets a broken value). */
function originOf(value: string | undefined): string | null {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

// Web security headers from docs/TRD.md section 8.5. HTTPS and HSTS come from Vercel.
// 'unsafe-inline' is needed for Next's inline bootstrap scripts; a nonce-based CSP is a later improvement.
const connectSrc = [
  "'self'",
  originOf(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"),
  originOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
  // Hot reload uses a websocket in development only.
  ...(isDev ? ["ws:", "http://localhost:*"] : []),
].filter(Boolean);

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' is development only (React refresh); production never gets it.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(" ")}`,
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
