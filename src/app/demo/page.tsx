// /demo — public showcase. Anyone can land here and see, in 30
// seconds, what sendoc does. The animated multi-cursor doc is the
// product story; everything else is supporting copy + CTAs.
//
// The /demo route is intentionally separate from /dashboard (which
// requires sign-in) — it's the "click to see if this is for me" path
// for visitors arriving from Show HN, Twitter, content marketing.

/* eslint-disable react/no-unescaped-entities */
"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { LiveDocDemo } from "@/components/LiveDocDemo";

export default function DemoPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gray-950 text-white">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 25% 0%, rgba(168,85,247,0.30), transparent 60%), radial-gradient(ellipse 80% 50% at 80% 30%, rgba(236,72,153,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(59,130,246,0.18), transparent 60%), #0a0a14",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Header */}
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-white"
          >
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-bold text-gray-900"
            >
              s
            </span>
            <span>sendoc</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="text-white/70 hover:text-white">
              Home
            </Link>
            <Link href="/login" className="text-white/70 hover:text-white">
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-10 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live demo · this is happening right now
          </span>

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Three peers.
            <br />
            <span className="bg-gradient-to-br from-purple-300 via-pink-200 to-orange-300 bg-clip-text text-transparent">
              One canvas.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
            Claude drafts. You direct. GPT-4 polishes. All in the same doc, at
            the same time. This animation is rendering live in your browser —
            it's a tiny preview of the real product.
          </p>
        </div>

        {/* The big demo */}
        <div className="mx-auto mt-12 max-w-5xl">
          <LiveDocDemo />
          <div className="mt-6 grid gap-4 text-center text-xs text-white/50 sm:grid-cols-3">
            <div>
              <div className="text-2xl font-semibold text-white">Yjs</div>
              <div className="mt-1">CRDT — no merge conflicts ever</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">200ms</div>
              <div className="mt-1">Median sync latency between peers</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">∞ agents</div>
              <div className="mt-1">
                Add as many AI teammates as you want (coming Q3)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What you just saw */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-3">
          <DemoStep
            n="1"
            title="Claude opens the doc"
            body="The Anthropic agent drafts a structure: title, sections, bones. You watch it build the outline live."
            color="#f97316"
          />
          <DemoStep
            n="2"
            title="You jump in"
            body="Your cursor lives next to Claude's. Type, edit, redirect. The agent doesn't fight you — it works around you."
            color="#a855f7"
          />
          <DemoStep
            n="3"
            title="GPT-4 polishes"
            body="The OpenAI agent fills the gaps Claude left. Different model, different strengths, same canvas."
            color="#10b981"
          />
        </div>
      </section>

      {/* Try it */}
      <section className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            The real editor, real cursors, real time — is one click away.
          </h2>
          <p className="mt-5 text-white/70">
            Open the app, start a doc, share the edit URL with a teammate. Or
            ask ChatGPT or Claude to publish to sendoc and skip the typing
            altogether.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-lg shadow-purple-900/20 transition hover:bg-gray-100"
            >
              Open the app →
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-6 text-xs text-white/40">
            No credit card. Free forever for solo users.
          </p>
        </div>
      </section>

      {/* Quiet footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-white/40 sm:flex-row sm:items-center">
          <span>© sendoc · One canvas. Every mind.</span>
          <nav className="flex gap-4">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function DemoStep({
  n,
  title,
  body,
  color,
}: {
  n: string;
  title: string;
  body: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div
        className="mb-4 inline-grid h-9 w-9 place-items-center rounded-xl text-sm font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {n}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/70">{body}</p>
    </div>
  );
}
