// Optional explicit sign-in page.
// Most users will sign in via the SaveYourWorkBanner upgrade flow, but this
// route exists for users who land here directly (e.g. from an email link).
//
// Strategy: if you're already signed in (anon or Google), just bounce to dashboard.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
} from "firebase/auth";
import { type FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { user, isAnonymous, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !isAnonymous) {
      router.replace("/dashboard");
    }
  }, [loading, user, isAnonymous, router]);

  const handleSignIn = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Sign out the anon user first, then sign in with Google.
      // This means anon docs from this session are abandoned — that's the
      // intended behavior for someone arriving fresh at /login.
      if (auth.currentUser?.isAnonymous) await signOut(auth);
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace("/dashboard");
    } catch (e) {
      const fe = e as FirebaseError;
      if (fe.code !== "auth/popup-closed-by-user") {
        setErr(fe.message || "Sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 text-3xl font-bold">Sign in to sendoc</h1>
      <p className="mb-8 text-sm text-gray-600">
        You don&apos;t need to sign in to use sendoc — but doing so saves your
        documents and lets you access them from any device.
      </p>

      <button
        onClick={handleSignIn}
        disabled={busy}
        className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {busy ? "Signing in…" : "Sign in with Google"}
      </button>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <p className="mt-10 text-xs text-gray-400">
        Or{" "}
        <a
          href="/dashboard"
          className="underline underline-offset-2 hover:text-gray-700"
        >
          continue without signing in
        </a>
        .
      </p>
    </main>
  );
}
