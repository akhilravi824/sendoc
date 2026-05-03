"use client";

// "Send by email" affordance for the public share page (/d/[token]).
//
// Different from the owner-only collaborator panel on /edit/[editToken]:
// this one is for ANY visitor to forward the link to a friend without
// signing in or being granted persistent permission. Just an email
// pass-through — recipient gets a message with the share URL.
//
// Falls back to a mailto: link if Resend isn't configured server-side
// (the API route returns the mailto string in that case).

import { useEffect, useRef, useState } from "react";

interface Props {
  token: string;
  /** The doc title shows up in the form's tagline + subject line. */
  docTitle: string;
}

type Phase = "idle" | "sending" | "sent" | "fallback" | "error";

export function SendByEmailButton({ token, docTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [fromName, setFromName] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mailto, setMailto] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // Click-outside to close.
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

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) return;
    setPhase("sending");
    setError(null);
    setMailto(null);
    try {
      const res = await fetch(`/api/share/${token}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          fromName: fromName.trim(),
          note: note.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 200) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      if (json.sent) {
        setPhase("sent");
        // Auto-close after a moment so the success state feels finished.
        setTimeout(() => {
          setOpen(false);
          setPhase("idle");
          setTo("");
          setNote("");
        }, 2000);
      } else if (json.mailto) {
        // Resend not configured — open user's email client instead.
        setMailto(json.mailto);
        setPhase("fallback");
      } else {
        throw new Error(json.message || "Email failed to send.");
      }
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Couldn't send.");
    }
  };

  return (
    <div ref={ref} className="relative print:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
      >
        Send by email
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-[22rem] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <p className="mb-1 text-sm font-semibold text-gray-900">
            Send this doc by email
          </p>
          <p className="mb-3 text-xs text-gray-500">
            We&apos;ll email <em className="not-italic">{docTitle}</em> to
            whoever you put below. They don&apos;t need a sendoc account
            to read it.
          </p>

          <form onSubmit={onSend} className="space-y-2.5">
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="friend@email.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              disabled={phase === "sending"}
            />
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              disabled={phase === "sending"}
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Quick note (optional)"
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              disabled={phase === "sending"}
            />

            <button
              type="submit"
              disabled={phase === "sending" || !to.trim()}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {phase === "sending" ? "Sending…" : "Send"}
            </button>
          </form>

          {phase === "sent" && (
            <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
              ✓ Sent to {to}
            </p>
          )}
          {phase === "fallback" && mailto && (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-medium">Email isn&apos;t set up yet.</p>
              <p className="mt-0.5">Open in your email client instead:</p>
              <a
                href={mailto}
                className="mt-2 inline-block rounded bg-amber-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-800"
              >
                Open email →
              </a>
            </div>
          )}
          {phase === "error" && error && (
            <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
