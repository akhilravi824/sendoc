const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

// Sentry build-time config. Sourcemaps + tunnel route to dodge ad blockers.
module.exports = withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build (cleaner CI output).
  silent: true,
  // Routes browser-side error reports through your own /monitoring/ path
  // so ad blockers don't drop them.
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
});
