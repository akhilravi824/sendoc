"use client";

import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Add a hotel section with budget, mid-range, and luxury options",
  "Make this more concise — cut filler",
  "Add a Quick Reference table at the end",
  "Translate this to Spanish",
  "Add a packing list",
  "Rewrite in a more formal tone",
];

type Phase = "idle" | "streaming" | "ready" | "error";

export function AskAIModal({
  open,
  onClose,
  editToken,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  editToken: string;
  onApply: (newContent: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset state when modal closes.
  useEffect(() => {
    if (!open) {
      setInstruction("");
      setPhase("idle");
      setOutput("");
      setError(null);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "streaming") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  const onGenerate = async () => {
    const text = instruction.trim();
    if (!text || phase === "streaming") return;
    setPhase("streaming");
    setOutput("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/edit/${editToken}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
      setPhase("ready");
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Request failed");
      setPhase("error");
    }
  };

  const onApplyClick = () => {
    if (!output) return;
    // Strip the moderation sentinel if present so it doesn't end up in
    // the published doc.
    const clean = output.replace(
      /\n*\[sendoc: this output was flagged.*$/,
      "",
    );
    onApply(clean);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">Ask AI to edit</h2>
          <button
            onClick={onClose}
            disabled={phase === "streaming"}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          <label htmlFor="ai-instruction" className="block text-sm font-medium text-gray-700">
            What should the AI do?
          </label>
          <textarea
            id="ai-instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Add a hotel section with three budget options"
            rows={3}
            disabled={phase === "streaming"}
            className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-gray-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
            }}
          />

          {phase === "idle" && (
            <div className="mt-3">
              <p className="text-xs text-gray-500">Try one of these:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInstruction(s)}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:border-brand hover:text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(phase === "streaming" || phase === "ready") && (
            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-500">
                <span>Preview</span>
                {phase === "streaming" && (
                  <span className="flex items-center gap-1.5 text-brand">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                    streaming
                  </span>
                )}
              </div>
              <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800">
                {output}
              </pre>
            </div>
          )}

          {phase === "error" && error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          {(phase === "idle" || phase === "error") && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onGenerate}
                disabled={!instruction.trim()}
                className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
              >
                Generate
              </button>
            </>
          )}
          {phase === "streaming" && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Stop
            </button>
          )}
          {phase === "ready" && (
            <>
              <button
                onClick={() => {
                  setPhase("idle");
                  setOutput("");
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Try a different instruction
              </button>
              <button
                onClick={onApplyClick}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Apply to document
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
