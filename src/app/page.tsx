// Marketing landing page. Replaces the previous "redirect everyone to
// /dashboard" behavior with a real front-door explaining what sendoc is.
// Signed-in users still have one-click access to their dashboard via the
// header.

/* eslint-disable react/no-unescaped-entities */
"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

export default function LandingPage() {
  return (
    <MarketingShell>
      <section className="border-b border-gray-100 bg-gradient-to-b from-white to-gray-50 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-medium text-brand">
            Connector for ChatGPT &amp; Claude
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Publish anything from your AI conversations as a shareable link.
          </h1>
          <p className="mt-5 text-lg text-gray-600">
            Tell ChatGPT or Claude to publish to sendoc — get back a public URL
            anyone can open. No accounts to share with, no setup for the reader.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Try sendoc
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-gray-900">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <div>
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
                1
              </div>
              <h3 className="text-base font-semibold text-gray-900">Talk to your AI</h3>
              <p className="mt-1 text-sm text-gray-600">
                Use ChatGPT or Claude as you normally do. Draft, edit, iterate.
              </p>
            </div>
            <div>
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
                2
              </div>
              <h3 className="text-base font-semibold text-gray-900">Say "publish to sendoc"</h3>
              <p className="mt-1 text-sm text-gray-600">
                The connector calls our API. Sendoc returns two URLs: a public read
                link and a private edit link.
              </p>
            </div>
            <div>
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
                3
              </div>
              <h3 className="text-base font-semibold text-gray-900">Share the link</h3>
              <p className="mt-1 text-sm text-gray-600">
                Send the read URL to anyone — works on any browser, any network.
                No sendoc account required to read.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            What sendoc gives you
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Feature
              title="Public share, no signup for readers"
              body="Anyone with the link can read. No account, no signin, no friction."
            />
            <Feature
              title="Token-gated editing"
              body="A separate edit URL lets only the people you trust modify the doc."
            />
            <Feature
              title="Markdown and HTML"
              body="Sendoc renders Markdown beautifully and supports authored HTML pages too."
            />
            <Feature
              title="Connector-native"
              body="Works with ChatGPT Custom GPTs, Claude MCP servers, or any HTTP client."
            />
            <Feature
              title="Built-in moderation"
              body="Every published doc passes through an automated content classifier."
            />
            <Feature
              title="Take-down on demand"
              body="Reports and takedowns are reviewed and acted on by sendoc administrators."
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold text-gray-900">
            Try it in 30 seconds
          </h2>
          <p className="mt-3 text-gray-600">
            Open the dashboard, type a prompt, get a share URL.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Open dashboard →
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </div>
  );
}
