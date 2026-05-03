"use client";

// Collaborator management for the doc owner. Lives on /edit/[editToken]
// when the signed-in viewer matches the doc's ownerId.
//
// Layout:
//   [ Add by email ] input + role select + Send
//   ─────────────────────────────────────────────
//   List of current collaborators with role + status + remove button
//
// Resend is optional. When unconfigured, the API returns the invite URL
// directly — we surface it in a "Copy link" affordance so the owner can
// share the link manually until Resend is wired up.

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

type Role = "viewer" | "editor";

type Collaborator = {
  collaboratorId: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "removed";
  invitedAt: number | null;
  acceptedAt: number | null;
};

interface Props {
  docId: string;
  /** Only the owner sees this panel. */
  isOwner: boolean;
}

export function CollaboratorsPanel({ docId, isOwner }: Props) {
  const { idToken } = useAuth();
  const [list, setList] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{
    url: string;
    email: string;
    emailSent: boolean;
    resendConfigured: boolean;
  } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refresh = async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/docs/${docId}/collaborators`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (res.ok) {
        setList(
          (json.collaborators as Collaborator[]).filter(
            (c) => c.status !== "removed",
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOwner || !idToken) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, idToken, docId]);

  if (!isOwner) return null;

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${docId}/collaborators`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      setLastInvite({
        url: json.inviteUrl,
        email: email.trim(),
        emailSent: !!json.emailSent,
        resendConfigured: !!json.resendConfigured,
      });
      setEmail("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send invite");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (c: Collaborator) => {
    if (!idToken) return;
    if (
      !window.confirm(
        `Remove ${c.email}? They'll lose access to this doc immediately.`,
      )
    )
      return;
    setRemovingId(c.collaboratorId);
    try {
      await fetch(
        `/api/docs/${docId}/collaborators/${c.collaboratorId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove");
    } finally {
      setRemovingId(null);
    }
  };

  const onCopyInviteUrl = async () => {
    if (!lastInvite) return;
    await navigator.clipboard.writeText(lastInvite.url);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Share with people
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        Invite by email — they&apos;ll see this doc on their dashboard the
        moment they sign in.
      </p>

      <form onSubmit={onInvite} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
          disabled={busy}
          className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-gray-50"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          disabled={busy}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send invite"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {lastInvite && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          {lastInvite.emailSent ? (
            <>
              <p className="font-medium">
                ✓ Invite sent to {lastInvite.email}
              </p>
              <p className="mt-0.5">
                They&apos;ll get an email with a link to accept.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">
                Invite created for {lastInvite.email}
              </p>
              <p className="mt-0.5">
                {lastInvite.resendConfigured
                  ? "Email failed to send. Share the link manually:"
                  : "Email isn't wired up yet — copy the link and send it however you like:"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={lastInvite.url}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 rounded border border-emerald-300 bg-white px-2 py-1 font-mono text-[11px] text-emerald-900"
                />
                <button
                  type="button"
                  onClick={onCopyInviteUrl}
                  className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-800"
                >
                  Copy
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-gray-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          People with access ({list.length})
        </p>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-gray-500">No one yet. Invite someone above.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((c) => (
              <li
                key={c.collaboratorId}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-800">
                    {c.email}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {c.role === "editor" ? "Editor" : "Viewer"} ·{" "}
                    {c.status === "accepted"
                      ? `Accepted ${formatRelativeMs(c.acceptedAt)}`
                      : `Pending · invited ${formatRelativeMs(c.invitedAt)}`}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(c)}
                  disabled={removingId === c.collaboratorId}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {removingId === c.collaboratorId ? "…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatRelativeMs(ms: number | null): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}
