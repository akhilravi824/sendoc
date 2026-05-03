"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DocBody, isHtmlDocument } from "@/components/DocBody";
import { SharePopover } from "@/components/SharePopover";
import { DownloadMenu } from "@/components/DownloadMenu";
import { SendByEmailButton } from "@/components/SendByEmailButton";
import { useAuth } from "@/components/AuthProvider";

type SharedDoc = {
  title: string;
  content: string;
  updatedAt: number | null;
  expiresAt: number | null;
  visibility?: "public" | "private";
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
  const { idToken, isAnonymous, loading: authLoading } = useAuth();
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    // Wait for auth to settle so we can attach a real ID token to the
    // request. Without it, private docs would always 401 on first paint
    // even for users who *are* signed in.
    if (authLoading) return;
    let cancelled = false;
    setError(null);
    setAuthRequired(false);
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (idToken && !isAnonymous) {
          headers.Authorization = `Bearer ${idToken}`;
        }
        const res = await fetch(`/api/share/${token}`, { headers });
        const json = await res.json();
        if (cancelled) return;
        if (res.status === 401 && json.error === "AUTH_REQUIRED") {
          setAuthRequired(true);
          return;
        }
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
  }, [token, idToken, isAnonymous, authLoading]);

  if (authRequired) {
    const next = `/d/${token}`;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Private document
          </p>
          <h1 className="text-xl font-semibold text-gray-900">
            Sign in to view this document
          </h1>
          <p className="text-sm text-gray-500">
            This link is for you — please don&rsquo;t share it with anyone else.
          </p>
        </div>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Continue to sign in
        </Link>
        <Link href="/" className="text-xs text-gray-400 hover:underline">
          What is sendoc?
        </Link>
      </main>
    );
  }

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
          <SendByEmailButton token={token} docTitle={doc.title} />
          <SharePopover title={doc.title} shareToken={token} />
          <SaveToDashboardButton token={token} />
          <SignInOrAccountChip token={token} />
        </div>
      </header>

      {doc.visibility === "private" && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This is a private document — please don&rsquo;t forward this link.
          Anyone you share it with will need to sign in to view.
        </p>
      )}

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
function SignInOrAccountChip({ token }: { token: string }) {
  const { isAnonymous, loading } = useAuth();
  if (loading) return null;
  if (isAnonymous) {
    // Send the user back to THIS share page after sign-in instead of
    // dropping them on /dashboard, so they don't lose the doc they
    // were trying to view.
    const next = `/d/${token}`;
    return (
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
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
