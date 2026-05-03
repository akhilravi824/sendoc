// /invite/[inviteToken] — public invite acceptance page.
//
// User flow:
//   1. Owner sends invite from /edit/[editToken] collaborator panel
//   2. Email lands in invitee's inbox with a link to this page
//   3. Page shows: "<inviter> invited you to <view|edit> <doc title>"
//   4. If signed in with the invited email → "Accept" button
//      If signed in with a different email → "Switch account" prompt
//      If not signed in → "Sign in to accept" + Google/email options
//   5. On accept → redirect to /d/<shareToken> (viewer) or
//      /edit/<editToken> equivalent (editor) — for now we route both
//      to /d/ since edit access for collaborators isn't surfaced yet
//      via a separate URL (planned: per-collaborator edit token, but
//      v1 just adds them to the doc's editable group)

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type InvitePreview = {
  docId: string;
  docTitle: string;
  invitedEmail: string;
  role: "viewer" | "editor";
  invitedByEmail: string | null;
  status: "pending" | "accepted" | "removed";
};

export default function InvitePage() {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const router = useRouter();
  const { user, idToken, isAnonymous, loading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invite/${inviteToken}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.message || json.error || "Invalid invite");
          return;
        }
        setPreview(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load invite");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const callerEmail = user?.email?.toLowerCase() ?? "";
  const invitedEmail = preview?.invitedEmail.toLowerCase() ?? "";
  const emailMatches = !!callerEmail && callerEmail === invitedEmail;
  const signedIn = !loading && user && !isAnonymous;

  const onAccept = async () => {
    if (!idToken || !preview) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${inviteToken}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      // Routed by role — for v1, both viewer and editor land on the
      // share-page since per-collaborator edit URLs aren't issued yet.
      router.replace(json.shareUrl || "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't accept invite");
    } finally {
      setAccepting(false);
    }
  };

  if (error) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-gray-900">
          Invite unavailable
        </h1>
        <p className="mt-3 text-gray-600">{error}</p>
        <div className="mt-6">
          <Link
            href="/"
            className="text-sm text-brand hover:underline"
          >
            Go to sendoc
          </Link>
        </div>
      </Shell>
    );
  }

  if (!preview) {
    return (
      <Shell>
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-4 w-64 animate-pulse rounded bg-gray-100" />
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">
        sendoc · invite
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
        {preview.invitedByEmail ?? "Someone"} shared a doc with you
      </h1>
      <p className="mt-3 text-gray-600">
        <strong className="text-gray-900">{preview.docTitle}</strong> ·{" "}
        you&apos;ll have <strong>{preview.role}</strong> access.
      </p>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
        <p>
          This invite is for{" "}
          <strong className="text-gray-900">{preview.invitedEmail}</strong>.
          Sign in with that email to accept.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {!signedIn ? (
          <>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}`}
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Sign in to accept
            </Link>
            <span className="text-xs text-gray-500">
              You&apos;ll come back here automatically.
            </span>
          </>
        ) : !emailMatches ? (
          <>
            <p className="text-sm text-amber-700">
              You&apos;re signed in as <strong>{user?.email}</strong>. The
              invite is for {preview.invitedEmail}.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}`}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Switch account
            </Link>
          </>
        ) : (
          <button
            onClick={onAccept}
            disabled={accepting}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
          >
            {accepting ? "Accepting…" : "Accept invite →"}
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="mb-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-gray-900"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-white"
          >
            s
          </span>
          <span>sendoc</span>
        </Link>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
