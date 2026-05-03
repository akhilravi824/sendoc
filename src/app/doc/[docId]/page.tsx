// /doc/[docId] — single document page (owner view).
// Open to anonymous users (the doc's owner is whoever's UID is in ownerId,
// which works for both anon and Google-backed UIDs).
//
// Owner-created docs (those generated from the dashboard prompt) don't
// have an editToken — only owner identity gates editing. So the
// collaborator panel needs to live here, not just on /edit/<editToken>.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { DocEditor } from "@/components/DocEditor";
import { ShareButton } from "@/components/ShareButton";
import { SignOutButton } from "@/components/SignOutButton";
import { CollaboratorsPanel } from "@/components/CollaboratorsPanel";
import { useAuth } from "@/components/AuthProvider";

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const { user, isAnonymous, loading } = useAuth();

  // We need the doc's ownerId to decide whether to render the
  // collaborator panel. Subscribing here is cheap because Firestore
  // dedups with the parallel subscription DocEditor opens for the
  // same doc.
  const [ownerId, setOwnerId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!user || !docId) return;
    const unsub = onSnapshot(doc(getDb(), "docs", docId), (snap) => {
      if (!snap.exists()) {
        setOwnerId(null);
        return;
      }
      setOwnerId((snap.data().ownerId as string | null) ?? null);
    });
    return () => unsub();
  }, [docId, user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  const isOwner = !!ownerId && ownerId === user.uid;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← All documents
        </Link>
        <div className="flex items-center gap-4">
          <ShareButton docId={docId} />
          {isAnonymous ? (
            <Link href="/login" className="text-sm text-brand hover:underline">
              Sign in
            </Link>
          ) : (
            <SignOutButton />
          )}
        </div>
      </header>

      <DocEditor docId={docId} />

      {/* Collaborator invites — owner-only. Same panel as on
          /edit/[editToken]; lives here too because owner-created docs
          don't have an editToken to navigate by. */}
      {isOwner && (
        <section className="mt-10">
          <CollaboratorsPanel docId={docId} isOwner />
        </section>
      )}
    </main>
  );
}
