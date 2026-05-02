"use client";

// Download / print menu for a single doc. Three options:
// - Print / Save as PDF — opens the native print dialog (every browser
//   can save its print preview as a PDF; lets us skip a server-side
//   render service for v1)
// - Download Markdown (.md) — for markdown docs
// - Download HTML (.html) — for html docs
//
// Pure client-side. The print stylesheet (`globals.css`) hides chrome
// during printing so the print dialog shows the document only.

import { useEffect, useRef, useState } from "react";
import { isHtmlDocument } from "./DocBody";

function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke a tick later so download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(title: string, ext: string): string {
  const slug = (title || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "document";
  return `${slug}.${ext}`;
}

export function DownloadMenu({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const isHtml = isHtmlDocument(content);

  const onPrint = () => {
    setOpen(false);
    window.print();
  };

  const onDownload = () => {
    setOpen(false);
    if (isHtml) {
      downloadText(safeFilename(title, "html"), content, "text/html");
    } else {
      const md = `# ${title}\n\n${content}`;
      downloadText(safeFilename(title, "md"), md, "text/markdown");
    }
  };

  return (
    <div ref={ref} className="relative print:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        aria-label="Download or print"
      >
        Download
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm shadow-lg">
          <button
            onClick={onPrint}
            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
          >
            Print / Save as PDF
          </button>
          <button
            onClick={onDownload}
            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
          >
            {isHtml ? "Download .html" : "Download .md"}
          </button>
        </div>
      )}
    </div>
  );
}
