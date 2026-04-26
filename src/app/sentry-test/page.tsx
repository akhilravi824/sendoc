"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryTestPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [eventId, setEventId] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const onSend = () => {
    setStatus("sending");
    setEventId(undefined);
    setErrorMsg(undefined);
    try {
      const id = Sentry.captureException(
        new Error(`sendoc test error @ ${new Date().toISOString()}`),
      );
      setEventId(id);
      // Force flush so we don't wait for the SDK's batched send.
      Sentry.flush(2000)
        .then(() => setStatus("sent"))
        .catch(() => setStatus("sent"));
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Sentry test</h1>
      <p className="mb-6 text-sm text-gray-500">
        Click the button to send an error to Sentry directly via the SDK
        (skipping global handlers). You should see a new issue in your Sentry
        dashboard within 30 seconds.
      </p>

      <button
        onClick={onSend}
        disabled={status === "sending"}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
      >
        {status === "sending" ? "Sending…" : "Send test error to Sentry"}
      </button>

      <div className="mt-6 space-y-2 text-sm">
        {status === "sent" && (
          <>
            <p className="text-green-700">
              ✓ Sentry returned event ID. The SDK believes it sent the event.
            </p>
            {eventId && (
              <p className="text-gray-600">
                Event ID:{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5">
                  {eventId}
                </code>
              </p>
            )}
            <p className="text-gray-600">
              If this event doesn&apos;t appear in Sentry within 30s, an ad
              blocker or browser extension is dropping the request. Open the
              Network tab and look for blocked requests to{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5">/monitoring</code>{" "}
              or{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5">
                ingest.sentry.io
              </code>
              .
            </p>
          </>
        )}
        {status === "error" && (
          <p className="text-red-700">
            ✗ SDK threw while sending: {errorMsg}
          </p>
        )}
      </div>
    </main>
  );
}
