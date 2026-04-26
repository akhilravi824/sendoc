"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type EditDoc = {
  docId: string;
  title: string;
  content: string;
  shareUrl: string;
  updatedAt: number | null;
};

type EditView = "split" | "edit" | "preview";

export default function EditPage() {
  const { editToken } = useParams<{ editToken: string }>();
  const [doc, setDoc] = useState<EditDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [view, setView] = useState<EditView>("split");
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

  const onCopyEdit = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/edit/${editToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-gray-500">
          {error === "Not found"
            ? "This edit link isn't valid or the doc has been removed."
            : error}
        </p>
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

        <span className="hidden min-w-[120px] text-right text-gray-400 sm:inline">
          {saving
            ? "Saving…"
            : savedAt
              ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
              : ""}
        </span>
      </div>

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
          <textarea
            value={doc.content}
            onChange={(e) => onContentChange(e.target.value)}
            className="min-h-[60vh] w-full resize-none rounded-lg border border-gray-200 bg-white p-6 font-mono text-sm leading-relaxed text-gray-800 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            placeholder="Start writing in Markdown…"
          />
        )}
        {(view === "preview" || view === "split") && (
          <div className="min-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-6">
            <article className="prose prose-gray prose-headings:font-semibold prose-h1:mb-6 prose-h1:text-3xl prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg max-w-none">
              {doc.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {doc.content}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-400">
                  Preview will appear here as you write.
                </p>
              )}
            </article>
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

      <div className="mt-8 border-t border-gray-100 pt-4">
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting…" : "Delete this document"}
        </button>
      </div>
    </main>
  );
}
