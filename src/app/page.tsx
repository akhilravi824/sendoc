// Landing page for sendoc.
//
// One story: the canvas where AI agents and humans write together,
// live. The dark hero tells that story in the most direct way possible
// — by showing it. Below the fold are three quiet light sections that
// explain the product and a closing CTA.

/* eslint-disable react/no-unescaped-entities */
"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { LiveDocDemo } from "@/components/LiveDocDemo";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ─── HERO — dark, bold, demo-led ───────────────────────── */}
      <section className="relative isolate overflow-hidden bg-gray-950 text-white">
        {/* Background gradient + grain */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 25% 0%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(ellipse 80% 50% at 80% 20%, rgba(59,130,246,0.25), transparent 60%), #0a0a14",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Top nav */}
        <header className="relative">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link href="/" className="flex items-center gap-2 font-semibold text-white">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-bold text-gray-900"
              >
                s
              </span>
              <span>sendoc</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/demo" className="text-white/70 hover:text-white">
                Demo
              </Link>
              <Link href="#how" className="hidden text-white/70 hover:text-white sm:inline">
                How it works
              </Link>
              <Link href="#pricing" className="hidden text-white/70 hover:text-white sm:inline">
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-white/70 hover:text-white"
              >
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

        <div className="mx-auto max-w-6xl px-6 pb-24 pt-12 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live multiplayer · AI agents as teammates
            </span>

            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              One canvas.
              <br />
              <span className="bg-gradient-to-br from-purple-300 via-pink-200 to-orange-300 bg-clip-text text-transparent">
                Every mind.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl">
              Sendoc is the live document where your AI agents collaborate with
              you and your team. Publish anywhere. Take down anytime.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-lg shadow-purple-900/20 transition hover:bg-gray-100"
              >
                Try the demo
                <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
              >
                Start writing
              </Link>
            </div>
          </div>

          {/* The live animated demo — centerpiece */}
          <div className="mx-auto mt-16 max-w-4xl">
            <LiveDocDemo />
            <p className="mt-4 text-center text-xs text-white/50">
              Three peers writing the same doc, in real time. This animation is
              live.
            </p>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS — light, three steps ─────────────────── */}
      <section id="how" className="border-t border-gray-100 bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Write together. With humans, with AI, or both.
            </h2>
          </div>

          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            <Step
              n="1"
              title="Open a doc"
              body="Type from scratch, paste a draft, or have ChatGPT or Claude publish to sendoc. You get a clean URL you control."
            />
            <Step
              n="2"
              title="Bring your team"
              body="Share the edit URL. Live cursors, instant sync, no merge conflicts. Drop AI agents into the doc the same way you'd add a teammate."
            />
            <Step
              n="3"
              title="Ship it"
              body="The public read URL works for anyone. Set an expiry. Audit who edited what. Take it down with one click when the work is done."
            />
          </div>
        </div>
      </section>

      {/* ─── REAL-TIME — light, with quote ─────────────────────── */}
      <section className="border-t border-gray-100 bg-gray-50 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                Real-time multiplayer
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Edit together. Like you've always wanted.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-gray-600">
                Yjs CRDT under the hood. Hocuspocus on the wire. Two browsers,
                one doc, live cursors with real names. No "refresh to see Bob's
                changes." No more lost paragraphs.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-700">
                <ListItem>Live cursors and presence indicators</ListItem>
                <ListItem>Conflict-free merging (CRDT, not last-write-wins)</ListItem>
                <ListItem>Up to 200 concurrent editors per doc</ListItem>
                <ListItem>Works on tab close, network drops, devices</ListItem>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <MiniMultiplayerMock />
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI AGENTS — dark, persona cards ───────────────────── */}
      <section className="relative isolate overflow-hidden bg-gray-950 px-6 py-24 text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(236,72,153,0.18), transparent 70%), #0a0a14",
          }}
        />
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-pink-300">
              AI agents
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your AI team, one canvas.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
              Drop AI agents into your doc the way you'd add a teammate. Each
              one shows up as a named cursor, edits in real time, and answers
              to the same comment threads.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AgentCard
              color="#f97316"
              initial="C"
              name="Claude"
              role="Writer"
              hint="Drafts the bones. Headings, sections, structure."
            />
            <AgentCard
              color="#10b981"
              initial="G"
              name="GPT-4"
              role="Editor"
              hint="Tightens prose, adds details, smooths transitions."
            />
            <AgentCard
              color="#3b82f6"
              initial="R"
              name="Researcher"
              role="Fact-checker"
              hint="Pulls links, verifies dates, flags uncertainty."
            />
            <AgentCard
              color="#a855f7"
              initial="Y"
              name="You"
              role="Director"
              hint="Decide what stays, what goes, what's next."
            />
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-lg shadow-pink-900/20 transition hover:bg-gray-100"
            >
              See agents collaborate live →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── LIFECYCLE — light ────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Lifecycle by default
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Take down what you publish.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Every doc has a clock. Every link can expire. Every change is in
              the audit log. The AI publishing layer that the AI labs forgot to
              ship.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              title="7-day TTL on anonymous docs"
              body="Published from ChatGPT or Claude without an account? Auto-expires after a week unless claimed."
            />
            <Feature
              title="Soft delete with 7-day restore"
              body="Mistakes don't stick. Anything deleted comes back within the grace window."
            />
            <Feature
              title="Audit log for every action"
              body="Publish, edit, AI run, copy, delete — every event has an actor, an IP, and a timestamp."
            />
            <Feature
              title="Identity-gated take-down"
              body="Sign in once. Manage every doc from a single dashboard. Revoke a link in two clicks."
            />
          </div>
        </div>
      </section>

      {/* ─── CONNECTORS ───────────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-gray-50 px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Connectors
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Plays nice with everyone.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Sendoc is the neutral surface. Native MCP for Claude. OpenAPI spec
            for ChatGPT GPT Actions. SDK for everyone else.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Tag>Claude (MCP)</Tag>
            <Tag>ChatGPT (GPT Actions)</Tag>
            <Tag>Anthropic API</Tag>
            <Tag>OpenAI API</Tag>
            <Tag>HTTP / curl</Tag>
            <Tag>npm / pip (coming)</Tag>
          </div>
        </div>
      </section>

      {/* ─── PRICING TEASER ───────────────────────────────────── */}
      <section id="pricing" className="border-t border-gray-100 bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Free for solo. Pro for serious. Studio for teams.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <PriceCard
              name="Free"
              price="$0"
              tagline="Forever, for the curious."
              features={[
                "sendoc.app subdomain",
                "5 docs per month",
                "1 AI agent",
                "7-day expiry on anonymous docs",
              ]}
              cta="Start writing"
              ctaHref="/dashboard"
            />
            <PriceCard
              highlight
              name="Pro"
              price="$19"
              tagline="For people shipping AI work."
              features={[
                "Custom domain",
                "200 docs per month",
                "3 AI agents",
                "Password-protect any link",
                "90-day expiry default",
              ]}
              cta="Go Pro"
              ctaHref="/dashboard"
            />
            <PriceCard
              name="Studio"
              price="$49"
              tagline="For teams and consultants."
              features={[
                "Everything in Pro",
                "Shared team workspace",
                "10 AI agents on tap",
                "Agent personas library",
                "Audit log export",
              ]}
              cta="Go Studio"
              ctaHref="/dashboard"
            />
          </div>
          <p className="mt-6 text-center text-xs text-gray-500">
            Cancel anytime. Annual saves 20%.
          </p>
        </div>
      </section>

      {/* ─── CLOSING CTA — dark again ─────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-gray-950 px-6 py-24 text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(168,85,247,0.25), transparent 70%), #0a0a14",
          }}
        />
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop publishing into the void.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
            Open a doc, drop in your AI team, hit publish. The link works
            everywhere. The takedown works instantly.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Try the demo →
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/10"
            >
              Open the app
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-gray-500 sm:flex-row sm:items-center">
          <span>© sendoc · One canvas. Every mind.</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
            <Link href="/demo" className="hover:text-gray-900">Demo</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ── Small section helpers ──────────────────────────────────────────────

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="mb-4 inline-grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-sm font-bold text-brand">
        {n}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-600">{body}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-md">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
      {children}
    </span>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-brand" />
      <span>{children}</span>
    </li>
  );
}

function AgentCard({
  color,
  initial,
  name,
  role,
  hint,
}: {
  color: string;
  initial: string;
  name: string;
  role: string;
  hint: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/10">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initial}
        </span>
        <div>
          <div className="text-sm font-semibold text-white">{name}</div>
          <div className="text-xs text-white/60">{role}</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-white/70">{hint}</p>
      <span
        aria-hidden
        className="absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function PriceCard({
  name,
  price,
  tagline,
  features,
  cta,
  ctaHref,
  highlight = false,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-6 ${
        highlight
          ? "border-brand/40 bg-gradient-to-br from-brand/5 to-purple-50 shadow-lg shadow-purple-200/40"
          : "border-gray-200 bg-white"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
      <p className="mt-1 text-sm text-gray-600">{tagline}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight text-gray-900">
          {price}
        </span>
        {price !== "$0" && <span className="text-sm text-gray-500">/mo</span>}
      </div>
      <ul className="mt-6 space-y-2 text-sm text-gray-700">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="text-brand">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-7 block w-full rounded-xl px-4 py-2 text-center text-sm font-semibold transition ${
          highlight
            ? "bg-gray-900 text-white hover:bg-gray-700"
            : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

/**
 * Tiny static mock of a "two humans editing" view, used in the
 * Real-time multiplayer section. Decorative only; no animation needed.
 */
function MiniMultiplayerMock() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 font-mono text-[12.5px] leading-[1.7] text-gray-800">
      <p className="text-gray-500"># Q2 launch plan</p>
      <p className="mt-3">
        ## Goals{" "}
        <span className="relative">
          <span className="inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-purple-500" />
          <span className="absolute -top-5 left-0 whitespace-nowrap rounded-md bg-purple-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Akhil
          </span>
        </span>
      </p>
      <p className="mt-2">- Ship the new editor</p>
      <p>
        - Land 5 design partners{" "}
        <span className="relative">
          <span className="inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-emerald-500" />
          <span className="absolute -top-5 left-0 whitespace-nowrap rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Sam
          </span>
        </span>
      </p>
      <p className="mt-2 text-gray-500">## Risks</p>
      <p>- Rate limits in Anthropic API</p>
    </div>
  );
}
