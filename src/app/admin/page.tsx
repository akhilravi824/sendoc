"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type AdminDoc = {
  docId: string;
  title: string;
  ownerId: string;
  ownerEmail: string | null;
  status: string;
  shareActive: boolean;
  shareToken: string | null;
  contentSize: number;
  createdAt: number | null;
  updatedAt: number | null;
};

type Report = {
  id: string;
  docId: string;
  reason: string | null;
  reporterUid: string | null;
  createdAt: number | null;
};

type Stats = {
  total: number;
  active: number;
  removed: number;
  pendingReports: number;
};

export default function AdminPage() {
  const { user, idToken, loading } = useAuth();
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyDoc, setBusyDoc] = useState<string | null>(null);

  const load = async (token: string) => {
    setError(null);
    const res = await fetch("/api/admin/docs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || `HTTP ${res.status}`);
      return;
    }
    setDocs(json.docs);
    setReports(json.reports);
    setStats(json.stats ?? null);
  };

  useEffect(() => {
    if (!idToken) return;
    load(idToken);
  }, [idToken]);

  const onTakedown = async (doc: AdminDoc) => {
    if (!idToken) return;
    const restore = !doc.shareActive;
    if (!restore) {
      const ok = window.confirm(
        `Take down "${doc.title}"?\n\nThis disables the share link and marks the doc as removed.`,
      );
      if (!ok) return;
    }
    const reason = restore
      ? null
      : window.prompt("Reason (optional, shown in audit log):") || null;

    setBusyDoc(doc.docId);
    try {
      const res = await fetch("/api/admin/takedown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ docId: doc.docId, reason, restore }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await load(idToken);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyDoc(null);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  if (error) {
    const forbidden = error === "FORBIDDEN" || error.includes("Forbidden");
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-4 text-xl font-semibold">Admin</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {forbidden ? (
            <>
              <p className="font-medium">Not authorized.</p>
              <p className="mt-2 text-sm">
                Your UID:{" "}
                <code className="rounded bg-white px-1 py-0.5">{user.uid}</code>
              </p>
              <p className="mt-1 text-sm">
                Email: <code className="rounded bg-white px-1 py-0.5">{user.email ?? "(none — sign in with Google)"}</code>
              </p>
              <p className="mt-3 text-sm">
                To grant admin: run{" "}
                <code className="rounded bg-white px-1 py-0.5">
                  node scripts/grant-admin.mjs {user.email ?? "<your-email>"}
                </code>{" "}
                — then sign out and back in.
              </p>
            </>
          ) : (
            error
          )}
        </div>
      </main>
    );
  }

  const reportsByDoc = new Map<string, Report[]>();
  for (const r of reports) {
    if (!reportsByDoc.has(r.docId)) reportsByDoc.set(r.docId, []);
    reportsByDoc.get(r.docId)!.push(r);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 rounded-lg bg-red-600 px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-white">
        Admin mode · all actions are logged
      </div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          ← back to app
        </Link>
      </header>

      {stats && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Total docs</div>
            <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Active links</div>
            <div className="mt-1 text-2xl font-semibold text-green-700">{stats.active}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Removed</div>
            <div className="mt-1 text-2xl font-semibold text-red-700">{stats.removed}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Pending reports</div>
            <div className="mt-1 text-2xl font-semibold text-amber-700">{stats.pendingReports}</div>
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent reports ({reports.length})
          </h2>
          <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {reports.slice(0, 10).map((r) => {
              const doc = docs.find((d) => d.docId === r.docId);
              return (
                <li key={r.id} className="py-1">
                  <span className="font-medium">{doc?.title ?? r.docId}</span>
                  {r.reason && <span> — {r.reason}</span>}
                  <span className="ml-2 text-xs text-amber-700">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        All documents ({docs.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reports</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => {
              const isRemoved = doc.status !== "active" || !doc.shareActive;
              const docReports = reportsByDoc.get(doc.docId) ?? [];
              return (
                <tr key={doc.docId} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/doc/${doc.docId}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {doc.title}
                    </Link>
                    {doc.shareToken && (
                      <div className="mt-0.5 text-xs text-gray-400">
                        <Link href={`/d/${doc.shareToken}`} className="hover:underline">
                          /d/{doc.shareToken.slice(0, 8)}…
                        </Link>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {doc.ownerEmail ?? (
                      <span className="text-gray-400">anon · {doc.ownerId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isRemoved ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                        removed
                      </span>
                    ) : (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {docReports.length || ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : ""}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onTakedown(doc)}
                      disabled={busyDoc === doc.docId}
                      className={`rounded px-2 py-1 text-xs ${
                        isRemoved
                          ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                    >
                      {busyDoc === doc.docId
                        ? "…"
                        : isRemoved
                          ? "Restore"
                          : "Take down"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
