import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Every page in CFM Workplace is per-user and live, so Cache Components /
  // partial prefetching are left off and pages render dynamically per request.
  poweredByHeader: false,
  // 90 is used for the sign-in office photo, where 75 visibly softens the detail.
  images: { qualities: [75, 90] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Always fetch the latest service worker so fixes reach phones right away.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
