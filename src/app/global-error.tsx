"use client";

// Catches React render errors that bubble past every per-route
// `error.tsx` boundary in the App Router. Required by Sentry's Next.js
// App Router setup so render errors land in the dashboard, not just
// the user's console.

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
