"use client";

import { useEffect, useState } from "react";
import { doc as docRef, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function ShareButton({ docId }: { docId: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await getDoc(docRef(db, "docs", docId));
      if (cancelled || !snap.exists()) return;
      const token = snap.data()?.shareLink?.token;
      if (token && typeof window !== "undefined") {
        setShareUrl(`${window.location.origin}/d/${token}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const onCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!shareUrl}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
      >
        Share
      </button>
      {open && shareUrl && (
        <div className="absolute right-0 top-10 z-10 w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-gray-500">
            Anyone with this link can view the document.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
            />
            <button
              onClick={onCopy}
              className="shrink-0 rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
