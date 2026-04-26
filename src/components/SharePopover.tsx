"use client";

import { useEffect, useRef, useState } from "react";

// Share dropdown for the public share view. Four actions:
// - Copy link → clipboard
// - Email → opens mailto: in the user's email client (no backend needed —
//   user enters recipients in their own email app)
// - Make a copy → forks the doc into a new editable copy
// - System share → only on devices with navigator.share (mobile mostly)

export function SharePopover({
  title,
  shareToken,
}: {
  title: string;
  shareToken: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [forking, setForking] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHasNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const url = typeof window !== "undefined" ? window.location.href : "";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this URL:", url);
    }
  };

  const onEmail = () => {
    const subject = encodeURIComponent(title || "A sendoc document");
    const body = encodeURIComponent(
      `I shared a document with you on sendoc:\n\n${title}\n${url}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  const onNativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // user cancelled — no-op
    }
    setOpen(false);
  };

  const onMakeCopy = async () => {
    setForking(true);
    try {
      const res = await fetch(`/api/share/${shareToken}/copy`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      // Send the copier straight to their new editable copy.
      window.location.href = json.editUrl;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not copy this doc.");
      setForking(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        {copied ? "Copied!" : "Share"}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <button
            onClick={() => {
              onCopy();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <span aria-hidden>🔗</span> Copy link
          </button>
          <button
            onClick={onEmail}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <span aria-hidden>✉️</span> Email
          </button>
          <button
            onClick={onMakeCopy}
            disabled={forking}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <span aria-hidden>📋</span>
            {forking ? "Copying…" : "Make a copy"}
          </button>
          {hasNativeShare && (
            <button
              onClick={onNativeShare}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <span aria-hidden>📤</span> More…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
