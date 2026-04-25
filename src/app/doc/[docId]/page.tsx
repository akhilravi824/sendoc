// /doc/[docId] — single document page (owner view).
// Open to anonymous users (the doc's owner is whoever's UID is in ownerId,
// which works for both anon and Google-backed UIDs).
//
// Sprint 3 will add: ShareSheet, public /d/[token] resolver for non-owners,
// link-gated and identity-gated permissions.

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DocEditor } from "@/components/DocEditor";
import { ShareButton } from "@/components/ShareButton";
import { SignOutButton } from "@/components/SignOutButton";
import { useAuth } from "@/components/AuthProvider";

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const { user, isAnonymous, loading } = useAuth();

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

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
    </main>
  );
}
