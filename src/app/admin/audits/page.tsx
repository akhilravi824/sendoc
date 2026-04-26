"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type Audit = {
  id: string;
  action: string;
  actor: { uid: string; email?: string | null; role?: string | null } | null;
  target: { type: string; id: string } | null;
  reason: string | null;
  diff: { before?: unknown; after?: unknown } | null;
  createdAt: number | null;
};

export default function AuditLogPage() {
  const { user, idToken, loading } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) return;
    (async () => {
      const res = await fetch("/api/admin/audits", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setAudits(json.audits);
    })();
  }, [idToken]);

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

      <p className="mb-6 text-sm text-gray-500">
        Append-only record of every privileged action. Most recent first; last 200 events.
      </p>

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
                    <div className="font-medium">{a.actor?.email ?? "—"}</div>
                    <div className="text-xs text-gray-400">
                      {a.actor?.role}
                      {a.actor?.uid && ` · ${a.actor.uid.slice(0, 8)}`}
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
                    {a.diff && (
                      <button
                        onClick={() => setExpanded(open ? null : a.id)}
                        className="text-xs text-brand hover:underline"
                      >
                        {open ? "hide diff" : "show diff"}
                      </button>
                    )}
                    {open && a.diff && (
                      <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-gray-50 p-2 text-left text-xs text-gray-700">
                        {JSON.stringify(a.diff, null, 2)}
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
