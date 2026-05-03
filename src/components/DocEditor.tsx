"use client";

// The document view + editor.
// - Subscribes to Firestore for live content of docs/{docId}
// - On mount, if URL says ?generate=1, calls /api/generate to stream Claude's
//   output and writes incremental updates back to Firestore
// - Also a basic textarea so the user can edit after generation
//
// Sprint 4 will replace this with Tiptap + Yjs + Hocuspocus for real-time
// multi-user editing. For now: single-user read/write.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";

type Doc = {
  docId: string;
  title: string;
  content: string;
  ownerId: string;
  status: string;
};

export function DocEditor({ docId }: { docId: string }) {
  const { user, idToken } = useAuth();
  const params = useSearchParams();
  const shouldGenerate = params.get("generate") === "1";
  const initialPrompt = params.get("prompt") || "";

  const [doc_, setDoc] = useState<Doc | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const generationStartedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live-subscribe to the doc.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(getDb(), "docs", docId), (snap) => {
      if (!snap.exists()) {
        setError("Document not found");
        return;
      }
      const data = snap.data() as Doc;
      setDoc({ ...data, docId });
      // Only sync the textarea from the server while we're streaming, or
      // before the user has typed anything locally. Prevents clobbering edits.
      if (streaming || draftContent === "") {
        setDraftContent(data.content || "");
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, user, streaming]);

  // Kick off AI generation if the URL says so.
  useEffect(() => {
    if (!shouldGenerate || !initialPrompt || !idToken) return;
    if (generationStartedRef.current) return;
    generationStartedRef.current = true;

    (async () => {
      setStreaming(true);
      setError(null);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ docId, prompt: initialPrompt }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        // Server streams plain text chunks; just consume them.
        // The server is also persisting the running content to Firestore,
        // so the snapshot listener above will update the textarea live.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done } = await reader.read();
          if (done) break;
          // We don't actually need to do anything with the chunks here —
          // Firestore is the source of truth for the rendered content.
          decoder.decode(); // no-op flush
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Generation failed";
        setError(msg);
      } finally {
        setStreaming(false);
      }
    })();
  }, [shouldGenerate, initialPrompt, idToken, docId]);

  // Debounced auto-save when the user edits the textarea.
  const onLocalEdit = (next: string) => {
    setDraftContent(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateDoc(doc(getDb(), "docs", docId), {
          content: next,
          updatedAt: serverTimestamp(),
        });
        setSavedAt(new Date());
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Save failed";
        setError(msg);
      }
    }, 500);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (!doc_) {
    return <div className="text-gray-500">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <input
          value={doc_.title}
          onChange={async (e) => {
            const next = e.target.value;
            setDoc({ ...doc_, title: next });
            await updateDoc(doc(getDb(), "docs", docId), {
              title: next,
              updatedAt: serverTimestamp(),
            });
          }}
          className="w-full bg-transparent text-2xl font-semibold focus:outline-none"
          placeholder="Untitled"
        />
        <span className="ml-4 shrink-0 text-xs text-gray-400">
          {streaming
            ? "Generating…"
            : savedAt
              ? `Saved ${savedAt.toLocaleTimeString()}`
              : ""}
        </span>
      </header>

      <textarea
        value={draftContent}
        onChange={(e) => onLocalEdit(e.target.value)}
        readOnly={streaming}
        className="min-h-[60vh] w-full resize-none rounded-lg border border-gray-200 bg-white p-6 font-mono text-sm leading-relaxed text-gray-800 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        placeholder="Your document will appear here…"
      />

      <p className="text-xs text-gray-400">
        Markdown is stored as raw text for now. Sprint 4 wires this up to a
        rich-text editor (Tiptap) with real-time collaboration.
      </p>
    </div>
  );
}
