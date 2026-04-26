// Sentry — runs in the Edge runtime (middleware, edge routes).
// We don't currently use the edge runtime, but having this file means we
// won't lose error visibility if we add an edge route later.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? "development",
});
