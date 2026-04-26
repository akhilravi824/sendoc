// Sentry — runs in the browser. Catches React render errors, fetch
// failures, console.error, and unhandled rejections.
// DSN is public-by-design (it identifies the project, not a secret key).

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 10% of transactions traced — enough to spot regressions, won't blow
  // through the free-tier event quota.
  tracesSampleRate: 0.1,
  // Replay sessions for 10% of all users + 100% of users who hit an error.
  // Adjust if quota gets tight.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
});
