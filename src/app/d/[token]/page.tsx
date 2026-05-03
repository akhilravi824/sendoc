"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DocBody, isHtmlDocument } from "@/components/DocBody";
import { SharePopover } from "@/components/SharePopover";
import { DownloadMenu } from "@/components/DownloadMenu";
import { useAuth } from "@/components/AuthProvider";

type SharedDoc = {
  title: string;
  content: string;
  updatedAt: number | null;
  expiresAt: number | null;
};

type SaveStatus = {
  saved: boolean;
  signedIn: boolean;
  ownedBySelf?: boolean;
};

function SaveToDashboardButton({ token }: { token: string }) {
  const { idToken, isAnonymous, loading } = useAuth();
  const [status, setStatus] = useState<SaveStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch initial state — only meaningful when signed in.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const headers: Record<string, string> = {};
      if (idToken && !isAnonymous) headers.Authorization = `Bearer ${idToken}`;
      const res = await fetch(`/api/share/${token}/save/status`, { headers });
      if (cancelled) return;
      if (res.ok) {
        const json = (await res.json()) as SaveStatus;
        setStatus(json);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, idToken, isAnonymous, loading]);

  if (loading || !status) return null;

  // Anonymous + signed-out users see a "Sign in to save" CTA via the
  // existing Sign in button in the header. Don't double up here.
  if (!status.signedIn) return null;

  // Owner sees nothing — they already manage this doc from their
  // dashboard's "Mine" tab.
  if (status.ownedBySelf) return null;

  const onClick = async () => {
    if (!idToken || busy) return;
    setBusy(true);
    try {
      const method = status.saved ? "DELETE" : "POST";
      const res = await fetch(`/api/share/${token}/save`, {
        method,
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        setStatus({ ...status, saved: !status.saved });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
        status.saved
          ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
      }`}
      title={status.saved ? "Remove from dashboard" : "Save to my dashboard"}
    >
      {busy ? "…" : status.saved ? "✓ Saved" : "+ Save"}
    </button>
  );
}

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
    const message =
      error === "Not found"
        ? "This link isn't valid or has been revoked."
        : error === "EXPIRED"
          ? "This share link has expired. Anonymous docs are removed after 7 days unless claimed by a sendoc account."
          : error;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-gray-500">{message}</p>
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

  // HTML documents take the full page width to do justice to their layout.
  // Markdown stays in a comfortable reading column.
  const isHtml = isHtmlDocument(doc.content);
  const wrapClass = isHtml
    ? "mx-auto max-w-6xl px-4 py-6"
    : "mx-auto max-w-3xl px-6 py-8";

  return (
    <main className={wrapClass}>
      <header className="mb-6 flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <Link href="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">
          sendoc
        </Link>
        <div className="flex items-center gap-3">
          {doc.expiresAt && (
            <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 sm:inline">
              Expires {new Date(doc.expiresAt).toLocaleDateString()}
            </span>
          )}
          <span className="hidden text-xs text-gray-400 sm:inline">
            Shared document · read-only
          </span>
          <DownloadMenu title={doc.title} content={doc.content} />
          <SharePopover title={doc.title} shareToken={token} />
          <SaveToDashboardButton token={token} />
          <SignInOrAccountChip />
        </div>
      </header>

      {isHtml && (
        <h1 className="mb-4 text-2xl font-semibold text-gray-900">{doc.title}</h1>
      )}

      <DocBody title={doc.title} content={doc.content} />

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

/**
 * Auth chip for the share page header. Shows "Sign in" when anonymous,
 * a small dashboard link when signed in.
 */
function SignInOrAccountChip() {
  const { isAnonymous, loading } = useAuth();
  if (loading) return null;
  if (isAnonymous) {
    return (
      <Link
        href="/login"
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
      >
        Sign in
      </Link>
    );
  }
  return (
    <Link
      href="/dashboard"
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
    >
      Dashboard
    </Link>
  );
}
