"use client";

// Used on the dashboard to start a new document from a prompt.
// Calls /api/docs to create the doc + kick off generation, then navigates
// to /doc/[docId] where the streaming text will appear in real time.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function PromptBox() {
  const router = useRouter();
  const { idToken } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !idToken) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ mode: "ai_generate", prompt }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const { docId } = await res.json();
      // Pass the prompt through the URL so the doc page kicks off streaming.
      router.push(`/doc/${docId}?generate=1&prompt=${encodeURIComponent(prompt)}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErr(msg);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask sendoc to write something… e.g. 'A 3-day road trip itinerary from Seattle to Portland'"
        rows={3}
        className="w-full resize-none rounded-lg border border-gray-300 p-4 text-base shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <div className="flex items-center justify-between">
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy || !prompt.trim()}
          className="ml-auto rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Creating…" : "Generate document"}
        </button>
      </div>
    </form>
  );
}
