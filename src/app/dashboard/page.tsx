// Dashboard: list the user's docs + a prompt box to start a new one.
// Open to anonymous users — they get a banner suggesting they save their work.

"use client";

// Force dynamic rendering — this page reads per-user Firebase auth, so
// statically prerendering it at build time both fails (Firebase env vars
// flaky in build env) and is pointless (no user yet).
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { PromptBox } from "@/components/PromptBox";
import { SignOutButton } from "@/components/SignOutButton";
import { SaveYourWorkBanner } from "@/components/SaveYourWorkBanner";

type DocSummary = {
  docId: string;
  title: string;
  updatedAt?: { toDate: () => Date };
  meta?: { mode?: string };
  shareLink?: { token?: string; active?: boolean };
  status?: string;
};

export default function Dashboard() {
  const { user, isAnonymous, loading } = useAuth();
  const [docs, setDocs] = useState<DocSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "docs"),
      where("ownerId", "==", user.uid),
      orderBy("updatedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocs(
        snap.docs.map((d) => ({ ...(d.data() as DocSummary), docId: d.id })),
      );
    });
    return () => unsub();
  }, [user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            sendoc
          </p>
          <h1 className="text-2xl font-semibold">
            {isAnonymous
              ? "Hi"
              : `Hi ${user.displayName?.split(" ")[0] ?? "there"}`}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {!isAnonymous && (
            <Link
              href="/settings/connectors"
              className="text-gray-600 hover:text-gray-900"
            >
              Connectors
            </Link>
          )}
          {isAnonymous ? (
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>
          ) : (
            <SignOutButton />
          )}
        </div>
      </header>

      {/* Anonymous-only banner — disappears once user upgrades to Google */}
      <div className="mb-6">
        <SaveYourWorkBanner />
      </div>

      <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Start a new document
        </h2>
        <PromptBox />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Your documents
        </h2>
        {docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No documents yet. Try the prompt above.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {docs.map((d) => {
              const isApi = d.meta?.mode === "external_publish";
              const isCopy = d.meta?.mode === "anonymous_copy";
              const removed = d.status && d.status !== "active";
              return (
                <li key={d.docId}>
                  <Link
                    href={`/doc/${d.docId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {d.title || "Untitled"}
                        </span>
                        {isApi && (
                          <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                            API
                          </span>
                        )}
                        {isCopy && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                            Copy
                          </span>
                        )}
                        {removed && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-800">
                            Removed
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {d.updatedAt ? d.updatedAt.toDate().toLocaleString() : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
