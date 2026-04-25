// Dashboard: list the user's docs + a prompt box to start a new one.
// Open to anonymous users — they get a banner suggesting they save their work.

"use client";

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
        {isAnonymous ? (
          <Link href="/login" className="text-sm text-brand hover:underline">
            Sign in
          </Link>
        ) : (
          <SignOutButton />
        )}
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
            {docs.map((d) => (
              <li key={d.docId}>
                <Link
                  href={`/doc/${d.docId}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <span className="truncate font-medium">
                    {d.title || "Untitled"}
                  </span>
                  <span className="ml-4 shrink-0 text-xs text-gray-400">
                    {d.updatedAt
                      ? d.updatedAt.toDate().toLocaleString()
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
