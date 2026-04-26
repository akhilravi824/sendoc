"use client";

import Link from "next/link";
import { ReactNode } from "react";

// Shared chrome for static pages: landing, privacy, terms.
// Header has logo + dashboard link. Footer links to privacy/terms.
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
              s
            </span>
            <span>sendoc</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-gray-500 sm:flex-row sm:items-center">
          <span>© sendoc</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
