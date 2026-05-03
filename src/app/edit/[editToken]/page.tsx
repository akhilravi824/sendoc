"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DocBody, isHtmlDocument } from "@/components/DocBody";
import { AskAIModal } from "@/components/AskAIModal";
import { DownloadMenu } from "@/components/DownloadMenu";
import { TiptapEditor } from "@/components/TiptapEditor";
import { CollaboratorsPanel } from "@/components/CollaboratorsPanel";
import { useAuth } from "@/components/AuthProvider";

type EditDoc = {
  docId: string;
  title: string;
  content: string;
  shareUrl: string;
  updatedAt: number | null;
  ownerId: string | null;
  ownerEmail: string | null;
  expiresAt: number | null;
};

type EditView = "split" | "edit" | "preview";

export default function EditPage() {
  const { editToken } = useParams<{ editToken: string }>();
  const { user, idToken, isAnonymous } = useAuth();
  const [doc, setDoc] = useState<EditDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [view, setView] = useState<EditView>("split");
  const [askAIOpen, setAskAIOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  // Bumped only when AI apply forces a full content replace. Used as the
  // editor's React `key` so an apply remounts Tiptap with fresh content;
  // ordinary user typing does NOT bump this and the editor stays alive.
  const [aiApplyCount, setAiApplyCount] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/edit/${editToken}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to load");
          return;
        }
        setDoc(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editToken]);

  const queueSave = (next: Partial<EditDoc>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/edit/${editToken}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || json.error || `HTTP ${res.status}`);
        }
        setSavedAt(json.updatedAt ?? Date.now());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 600);
  };

  const onContentChange = (next: string) => {
    if (!doc) return;
    setDoc({ ...doc, content: next });
    queueSave({ content: next });
  };

  const onTitleChange = (next: string) => {
    if (!doc) return;
    setDoc({ ...doc, title: next });
    queueSave({ title: next });
  };

  const onCopyShare = async () => {
    if (!doc) return;
    await navigator.clipboard.writeText(doc.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onAIApply = (newContent: string) => {
    if (!doc) return;
    setDoc({ ...doc, content: newContent });
    queueSave({ content: newContent });
    // Force the editor to remount with the new content. Tiptap's
    // Collaboration extension can't be told to "replace the whole doc"
    // safely without disrupting the Yjs CRDT state; remount is the
    // simplest correct option for now.
    setAiApplyCount((n) => n + 1);
  };

  const onCopyEdit = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/edit/${editToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onClaim = async () => {
    if (!doc || !idToken) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch(`/api/edit/${editToken}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      setDoc({
        ...doc,
        ownerId: user?.uid ?? null,
        ownerEmail: user?.email ?? null,
      });
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this doc? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/edit/${editToken}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setDeleted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (deleted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-gray-700">Document deleted.</p>
        <Link href="/" className="text-sm text-brand hover:underline">
          Go to sendoc
        </Link>
      </main>
    );
  }

  if (error && !doc) {
    const message =
      error === "Not found"
        ? "This edit link isn't valid or the doc has been removed."
        : error === "EXPIRED"
          ? "This edit link has expired. Anonymous docs are removed after 7 days unless claimed."
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs">
        <Link href="/" className="text-gray-500 hover:text-gray-900">
          ← sendoc
        </Link>

        {/* View toggle: edit | split | preview */}
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
          {(["edit", "split", "preview"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 capitalize transition ${
                view === v
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <DownloadMenu title={doc.title} content={doc.content} />
          <button
            onClick={() => setAskAIOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            <span aria-hidden>✨</span> Ask AI
          </button>
          <span className="hidden min-w-[120px] text-right text-gray-400 sm:inline">
            {saving
              ? "Saving…"
              : savedAt
                ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
                : ""}
          </span>
        </div>
      </div>

      {!doc.ownerId && !isAnonymous && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div>
            <p className="font-medium">Save this doc to your account</p>
            <p className="mt-0.5">
              {doc.expiresAt
                ? `Anonymous docs expire ${new Date(doc.expiresAt).toLocaleDateString()}. Claim to keep it forever.`
                : "Add it to your dashboard so you can find it later without the edit URL."}
            </p>
            {claimError && (
              <p className="mt-1 text-red-700">{claimError}</p>
            )}
          </div>
          <button
            onClick={onClaim}
            disabled={claiming}
            className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {claiming ? "Claiming…" : "Claim doc"}
          </button>
        </div>
      )}
      {!doc.ownerId && isAnonymous && doc.expiresAt && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-medium">
            This doc expires {new Date(doc.expiresAt).toLocaleDateString()}
          </p>
          <p className="mt-0.5">
            Sign in with Google to keep it permanently. Anonymous docs are
            removed after 7 days.
          </p>
        </div>
      )}
      {doc.ownerId && user && doc.ownerId === user.uid && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-medium">Saved to your account</p>
          <p className="mt-0.5">
            This doc is in your{" "}
            <Link href="/dashboard" className="underline">
              dashboard
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-medium">Anyone with this URL can edit this doc.</p>
        <p className="mt-0.5">
          Share carefully. Use the public read-only link below to share with
          viewers.
        </p>
      </div>

      <input
        value={doc.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled"
        className="mb-4 w-full bg-transparent text-2xl font-semibold focus:outline-none"
      />

      <div
        className={`grid gap-4 ${
          view === "split" ? "lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {(view === "edit" || view === "split") && (
          <TiptapEditor
            key={`editor-${aiApplyCount}`}
            initialMarkdown={doc.content}
            onChange={onContentChange}
            placeholder="Start writing — your changes auto-save"
            docId={doc.docId}
            editToken={editToken}
            userName={user?.displayName ?? user?.email ?? "Anon"}
          />
        )}
        {(view === "preview" || view === "split") && (
          <div
            className={`min-h-[60vh] overflow-auto rounded-lg border border-gray-200 ${
              isHtmlDocument(doc.content) ? "bg-white p-0" : "bg-gray-50 p-6"
            }`}
          >
            {doc.content ? (
              <DocBody title={doc.title || "Untitled"} content={doc.content} />
            ) : (
              <p className="p-6 text-gray-400">
                Preview will appear here as you write.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Public read URL
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Anyone with this link can view the doc.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={doc.shareUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs"
            />
            <button
              onClick={onCopyShare}
              className="shrink-0 rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
            Edit URL
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Anyone with this link can edit. Share with collaborators only.
          </p>
          <button
            onClick={onCopyEdit}
            className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            {copied ? "Copied!" : "Copy edit URL"}
          </button>
        </div>
      </section>

      {/* Collaborators — owner-only. Email-based invites with optional
          Resend send. Hidden for unowned docs (claim first) and for
          non-owners who happen to hold the editToken. */}
      {doc.ownerId && user && doc.ownerId === user.uid && (
        <section className="mt-8">
          <CollaboratorsPanel docId={doc.docId} isOwner />
        </section>
      )}

      <div className="mt-8 border-t border-gray-100 pt-4">
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting…" : "Delete this document"}
        </button>
      </div>

      <AskAIModal
        open={askAIOpen}
        onClose={() => setAskAIOpen(false)}
        editToken={editToken}
        onApply={onAIApply}
      />
    </main>
  );
}
