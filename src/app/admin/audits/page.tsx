"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type AuditActor = {
  type?: string;
  uid?: string;
  email?: string | null;
  role?: string | null;
  keyId?: string | null;
  ip?: string | null;
};

type Audit = {
  id: string;
  action: string;
  actor: AuditActor | null;
  target: { type: string; id: string } | null;
  reason: string | null;
  diff: { before?: unknown; after?: unknown } | null;
  meta: Record<string, unknown> | null;
  createdAt: number | null;
};

type AuditTab = "admin" | "action";

export default function AuditLogPage() {
  const { user, idToken, loading } = useAuth();
  const [tab, setTab] = useState<AuditTab>("admin");
  const [audits, setAudits] = useState<Audit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [docIdFilter, setDocIdFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (!idToken) return;
    (async () => {
      setError(null);
      const params = new URLSearchParams();
      if (tab === "action") params.set("type", "action");
      if (actionFilter) params.set("action", actionFilter);
      if (docIdFilter) params.set("docId", docIdFilter);
      if (searchFilter) params.set("q", searchFilter);
      const qs = params.toString();
      const url = qs ? `/api/admin/audits?${qs}` : "/api/admin/audits";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setAudits(json.audits);
    })();
  }, [idToken, tab, actionFilter, docIdFilter, searchFilter]);

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
        <h1 className="mb-4 text-xl font-semibold">Audit log</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {forbidden ? "Not authorized." : error}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 rounded-lg bg-red-600 px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-white">
        Admin mode · all actions are logged
      </div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Audit log</h1>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900">
          ← admin home
        </Link>
      </header>

      <div className="mb-4 inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
        {(
          [
            { id: "admin", label: "Admin actions" },
            { id: "action", label: "Doc actions" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1 transition ${
              tab === t.id
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-gray-500">
        {tab === "admin"
          ? "Append-only record of privileged admin actions (takedowns, role grants). Most recent first; last 200 events."
          : "Append-only record of every doc action (publish, edit, delete, copy, AI edit). Most recent first; last 200 events."}
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder={
            tab === "admin"
              ? "action (e.g. doc.takedown)"
              : "action (e.g. doc.publish)"
          }
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
        <input
          value={docIdFilter}
          onChange={(e) => setDocIdFilter(e.target.value)}
          placeholder="target docId"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-mono text-xs focus:border-brand focus:outline-none"
        />
        <input
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="search actor / meta / reason"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {audits.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">
                  No audit entries yet.
                </td>
              </tr>
            )}
            {audits.map((a) => {
              const open = expanded === a.id;
              return (
                <tr key={a.id} className="border-t border-gray-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    <div className="font-medium">
                      {a.actor?.type === "anonymous"
                        ? "anonymous"
                        : (a.actor?.email ?? "—")}
                    </div>
                    <div className="text-xs text-gray-400">
                      {a.actor?.role || a.actor?.type}
                      {a.actor?.uid && ` · ${a.actor.uid.slice(0, 8)}`}
                      {a.actor?.keyId && ` · key:${a.actor.keyId.slice(0, 6)}`}
                      {a.actor?.ip && ` · ${a.actor.ip}`}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                      {a.action}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {a.target ? (
                      <>
                        <div className="text-gray-500">{a.target.type}</div>
                        <div className="font-mono">{a.target.id.slice(0, 12)}…</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {a.reason || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(a.diff || a.meta) && (
                      <button
                        onClick={() => setExpanded(open ? null : a.id)}
                        className="text-xs text-brand hover:underline"
                      >
                        {open ? "hide" : "show"}
                      </button>
                    )}
                    {open && (
                      <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-gray-50 p-2 text-left text-xs text-gray-700">
                        {JSON.stringify(a.diff ?? a.meta, null, 2)}
                      </pre>
                    )}
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
