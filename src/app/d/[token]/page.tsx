"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SharedDoc = {
  title: string;
  content: string;
  updatedAt: number | null;
};

function ReportButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const onReport = async () => {
    if (state !== "idle") return;
    const reason = window.prompt(
      "Why are you reporting this document? (optional)",
      "",
    );
    if (reason === null) return; // cancelled
    setState("sending");
    try {
      await fetch(`/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason }),
      });
      setState("sent");
    } catch {
      setState("idle");
    }
  };
  return (
    <button
      onClick={onReport}
      disabled={state !== "idle"}
      className="text-xs text-gray-400 hover:text-gray-700 disabled:cursor-default"
    >
      {state === "sent" ? "Reported — thanks" : "Report"}
    </button>
  );
}

export default function SharedDocPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/share/${token}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to load");
          return;
        }
        setDoc(json);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-gray-500">
          {error === "Not found"
            ? "This link isn't valid or has been revoked."
            : error}
        </p>
        <Link href="/" className="text-sm text-brand hover:underline">
          Go to sendoc
        </Link>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
        <Link href="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">
          sendoc
        </Link>
        <span className="text-xs text-gray-400">Shared document · read-only</span>
      </header>
      <article className="prose prose-gray prose-headings:font-semibold prose-h1:mb-6 prose-h1:text-3xl prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg max-w-none">
        <h1>{doc.title}</h1>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
      </article>
      <footer className="mt-12 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
        <span>
          Made with{" "}
          <Link href="/" className="text-brand hover:underline">
            sendoc
          </Link>
        </span>
        <ReportButton token={token} />
      </footer>
    </main>
  );
}
