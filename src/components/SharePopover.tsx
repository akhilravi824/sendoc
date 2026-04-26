"use client";

import { useEffect, useRef, useState } from "react";

// Share dropdown for the public share view. Three actions:
// - Copy link → clipboard
// - Email → opens mailto: in the user's email client (no backend needed —
//   user enters recipients in their own email app)
// - System share → only on devices with navigator.share (mobile mostly)

export function SharePopover({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
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
