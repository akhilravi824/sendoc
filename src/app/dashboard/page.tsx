// Dashboard: list the user's docs + a prompt box to start a new one.
// Open to anonymous users — they get a banner suggesting they save their work.

"use client";

// Force dynamic rendering — this page reads per-user Firebase auth, so
// statically prerendering it at build time both fails (Firebase env vars
// flaky in build env) and is pointless (no user yet).
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { PromptBox } from "@/components/PromptBox";
import { SignOutButton } from "@/components/SignOutButton";
import { SaveYourWorkBanner } from "@/components/SaveYourWorkBanner";

type DocSummary = {
  docId: string;
  title: string;
  updatedAt?: { toDate: () => Date };
  createdAt?: { toDate: () => Date };
  meta?: { mode?: string };
  shareLink?: { token?: string; active?: boolean };
  status?: string;
  purgeAt?: { toDate: () => Date };
};

type Filter = "all" | "live" | "removed";

function formatRelative(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function statusBadge(d: DocSummary) {
  if (d.status === "purged") {
    return { label: "Purged", className: "bg-gray-200 text-gray-600" };
  }
  if (d.status && d.status !== "active") {
    const purgeAt = d.purgeAt?.toDate?.();
    const daysLeft = purgeAt
      ? Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;
    return {
      label: daysLeft !== null ? `Deleted · ${daysLeft}d to restore` : "Deleted",
      className: "bg-red-100 text-red-800",
    };
  }
  return { label: "Live", className: "bg-emerald-100 text-emerald-800" };
}

export default function Dashboard() {
  const { user, idToken, isAnonymous, loading } = useAuth();
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(getDb(), "docs"),
      where("ownerId", "==", user.uid),
      orderBy("updatedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocs(
        snap.docs.map((d) => ({ ...(d.data() as DocSummary), docId: d.id })),
      );
    });
    return () => unsub();
  }, [user]);

  const counts = useMemo(() => {
    const live = docs.filter((d) => !d.status || d.status === "active").length;
    const removed = docs.filter((d) => d.status && d.status !== "active").length;
    return { all: docs.length, live, removed };
  }, [docs]);

  const filtered = useMemo(() => {
    if (filter === "all") return docs;
    if (filter === "live")
      return docs.filter((d) => !d.status || d.status === "active");
    return docs.filter((d) => d.status && d.status !== "active");
  }, [docs, filter]);

  const onDelete = async (doc: DocSummary) => {
    if (!idToken) return;
    if (
      !window.confirm(
        `Delete "${doc.title || "Untitled"}"? You'll have 7 days to restore it.`,
      )
    )
      return;
    setBusyDocId(doc.docId);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${doc.docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      // The Firestore snapshot listener will pick up the change.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyDocId(null);
    }
  };

  const onRestore = async (doc: DocSummary) => {
    if (!idToken) return;
    setBusyDocId(doc.docId);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${doc.docId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusyDocId(null);
    }
  };

  const onCopyShareUrl = async (doc: DocSummary) => {
    if (typeof window === "undefined") return;
    const token = doc.shareLink?.token;
    if (!token) return;
    const url = `${window.location.origin}/d/${token}`;
    await navigator.clipboard.writeText(url);
  };

  if (loading || !user) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              sendoc
            </p>
            <div className="mt-1 h-7 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="mb-12 h-40 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm" />
        <div className="h-32 animate-pulse rounded-lg border border-dashed border-gray-300 bg-white" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            sendoc
          </p>
          <h1 className="text-2xl font-semibold">
            {isAnonymous
              ? "Hi"
              : `Hi ${user.displayName?.split(" ")[0] ?? "there"}`}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {!isAnonymous && (
            <Link
              href="/settings/connectors"
              className="text-gray-600 hover:text-gray-900"
            >
              Connectors
            </Link>
          )}
          {isAnonymous ? (
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>
          ) : (
            <SignOutButton />
          )}
        </div>
      </header>

      {/* Anonymous-only banner — disappears once user upgrades to Google */}
      <div className="mb-6">
        <SaveYourWorkBanner />
      </div>

      <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Start a new document
        </h2>
        <PromptBox />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Your documents
          </h2>
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
            {(
              [
                { id: "all", label: `All (${counts.all})` },
                { id: "live", label: `Live (${counts.live})` },
                { id: "removed", label: `Deleted (${counts.removed})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded px-2.5 py-1 transition ${
                  filter === f.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm">
            <p className="font-medium text-gray-700">
              {filter === "all"
                ? "No documents yet"
                : filter === "live"
                  ? "No live documents"
                  : "No deleted documents"}
            </p>
            {filter === "all" && (
              <p className="mt-1 text-gray-500">
                Try the prompt above — e.g.{" "}
                <em className="not-italic text-gray-700">
                  &ldquo;Explain CRDTs in plain English&rdquo;
                </em>
                {" "}or paste a draft to publish.
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {filtered.map((d) => {
              const isApi = d.meta?.mode === "external_publish";
              const isCopy = d.meta?.mode === "anonymous_copy";
              const removed = d.status && d.status !== "active";
              const purged = d.status === "purged";
              const badge = statusBadge(d);
              const updated = d.updatedAt?.toDate?.();
              return (
                <li
                  key={d.docId}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {removed ? (
                        <span className="truncate font-medium text-gray-500 line-through">
                          {d.title || "Untitled"}
                        </span>
                      ) : (
                        <Link
                          href={`/doc/${d.docId}`}
                          className="truncate font-medium hover:underline"
                        >
                          {d.title || "Untitled"}
                        </Link>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {isApi && (
                        <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                          API
                        </span>
                      )}
                      {isCopy && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                          Copy
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {updated ? `Updated ${formatRelative(updated)}` : ""}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {!removed && (
                      <>
                        {d.shareLink?.token && (
                          <button
                            onClick={() => onCopyShareUrl(d)}
                            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title="Copy share URL"
                          >
                            Copy URL
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(d)}
                          disabled={busyDocId === d.docId}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busyDocId === d.docId ? "…" : "Delete"}
                        </button>
                      </>
                    )}
                    {removed && !purged && (
                      <button
                        onClick={() => onRestore(d)}
                        disabled={busyDocId === d.docId}
                        className="rounded px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {busyDocId === d.docId ? "…" : "Restore"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
