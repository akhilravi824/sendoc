"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type ApiKey = {
  keyId: string;
  name: string;
  prefix: string;
  createdAt: number | null;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

export default function ConnectorsPage() {
  const { user, idToken, isAnonymous, loading } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [justCreated, setJustCreated] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async (token: string) => {
    setError(null);
    const res = await fetch("/api/me/api-keys", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message || json.error || `HTTP ${res.status}`);
      return;
    }
    setKeys(json.keys);
  };

  useEffect(() => {
    if (idToken && !isAnonymous) load(idToken);
  }, [idToken, isAnonymous]);

  const onCreate = async () => {
    if (!idToken || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/me/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: newName || "Untitled key" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error);
      setJustCreated({ name: json.name, token: json.token });
      setNewName("");
      await load(idToken);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (keyId: string, name: string) => {
    if (!idToken) return;
    if (!window.confirm(`Revoke "${name}"? Any apps using this key will break.`)) return;
    setRevoking(keyId);
    try {
      const res = await fetch(`/api/me/api-keys/${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await load(idToken);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevoking(null);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  if (isAnonymous) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-4 text-xl font-semibold">Connectors</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">Sign in with Google first</p>
          <p className="mt-1 text-sm">
            API keys are tied to a permanent identity. Anonymous accounts
            can&apos;t generate keys.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-sm text-brand hover:underline"
          >
            Go to dashboard → click &quot;Save my work&quot;
          </Link>
        </div>
      </main>
    );
  }

  const liveKeys = keys.filter((k) => !k.revokedAt);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Connectors</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          ← back to app
        </Link>
      </header>

      <p className="mb-6 text-sm text-gray-600">
        API keys let Claude, ChatGPT, or any HTTP client publish documents
        to your sendoc account programmatically. Each key acts as you —
        keep them secret.
      </p>

      {/* Just-created key — shown ONCE */}
      {justCreated && (
        <section className="mb-8 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="text-sm font-semibold text-green-900">
            New key created: {justCreated.name}
          </h2>
          <p className="mt-1 text-xs text-green-800">
            Copy this now — sendoc won&apos;t show it again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={justCreated.token}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded border border-green-300 bg-white px-2 py-1 font-mono text-xs"
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(justCreated.token);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-800"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setJustCreated(null)}
            className="mt-3 text-xs text-green-800 hover:underline"
          >
            I&apos;ve copied it — dismiss
          </button>
        </section>
      )}

      {/* Create form */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Create a new key
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. 'Claude MCP', 'ChatGPT GPT')"
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            disabled={creating}
          />
          <button
            onClick={onCreate}
            disabled={creating}
            className="shrink-0 rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </div>
      </section>

      {/* Existing keys */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Your keys ({liveKeys.length})
        </h2>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {keys.length === 0 ? (
          <p className="text-sm text-gray-500">No keys yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {keys.map((key) => (
              <li
                key={key.keyId}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">
                    {key.name}
                    {key.revokedAt && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                        revoked
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-gray-400">
                    {key.prefix}…
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Created {key.createdAt ? new Date(key.createdAt).toLocaleString() : "—"}
                    {key.lastUsedAt && (
                      <> · last used {new Date(key.lastUsedAt).toLocaleString()}</>
                    )}
                  </div>
                </div>
                {!key.revokedAt && (
                  <button
                    onClick={() => onRevoke(key.keyId, key.name)}
                    disabled={revoking === key.keyId}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed"
                  >
                    {revoking === key.keyId ? "…" : "Revoke"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quickstart — how to use the key */}
      <section className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-2 text-sm font-semibold">How to use a key</h2>
        <p className="mb-3 text-xs text-gray-600">
          Make HTTP POST to <code className="rounded bg-white px-1">/api/external/docs</code>:
        </p>
        <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
{`curl -X POST https://sendoc-akhilravi824s-projects.vercel.app/api/external/docs \\
  -H "Authorization: Bearer sk_sendoc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My document",
    "content": "# Hello\\n\\nMarkdown content here."
  }'

# → 201 { docId, title, shareUrl }`}
        </pre>
        <p className="mt-3 text-xs text-gray-500">
          Claude MCP and ChatGPT Custom GPT setups (coming soon) call this
          same endpoint under the hood.
        </p>
      </section>

      <DangerZone idToken={idToken} userEmail={user.email} />
    </main>
  );
}

function DangerZone({
  idToken,
  userEmail,
}: {
  idToken: string | null;
  userEmail: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onDeleteAccount = async () => {
    if (!idToken || !userEmail) return;
    const confirm = window.prompt(
      `This will permanently delete your account and ALL your documents and API keys. Type "${userEmail}" to confirm.`,
    );
    if (confirm !== userEmail) {
      if (confirm !== null) alert("Email didn't match — deletion cancelled.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/me/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error);
      setDone(true);
      // Sign-out + redirect home after a beat.
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Deletion failed");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="mt-10 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-900">
        Account deleted. Redirecting…
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-lg border border-red-200 p-5">
      <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
      <p className="mt-1 text-xs text-gray-600">
        Permanently delete your account, all your documents, and all your
        API keys. This cannot be undone.
      </p>
      <button
        onClick={onDeleteAccount}
        disabled={busy}
        className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </section>
  );
}
