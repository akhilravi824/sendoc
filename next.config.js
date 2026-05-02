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
  silent: true,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
