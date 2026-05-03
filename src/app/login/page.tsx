// Sign-in / sign-up page.
//
// Two paths to the same account:
//   - Continue with Google (same flow either way — first-time creates,
//     subsequent signs in)
//   - Email + password — toggle between Sign in / Create account
//
// If the visitor is currently anonymous (Firebase auto-signs everyone in
// anonymously on first load), we LINK the new credential to the anon UID
// rather than replacing it. That preserves any docs they published this
// session. Only when the linked credential is *already* a Firebase user
// do we have to sign out the anon and sign in to the existing one,
// orphaning this session's anon docs.

"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { type FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Mode = "signin" | "signup";

// Map Firebase error codes to friendlier copy.
function friendlyError(e: unknown): string {
  const fe = e as FirebaseError;
  switch (fe.code) {
    case "auth/invalid-email":
      return "That email doesn't look right.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "No account matches that email + password.";
    case "auth/wrong-password":
      return "Wrong password. Try again or reset it.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password needs to be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in isn't enabled yet. Use Google for now.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/popup-blocked":
      return ""; // handled with redirect fallback
    default:
      return fe.message || "Something went wrong.";
  }
}


// Wrapper provides the Suspense boundary that Next.js requires whenever
// useSearchParams() is called in an App Router client page. Without it,
// the production build aborts with "useSearchParams() should be wrapped
// in a suspense boundary at page /login".
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-gray-500">
          Loading…
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { user, isAnonymous, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | "reset" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Where to send the user after sign-in. Defaults to /dashboard but
  // honors a ?next=/d/<token> param so a viewer who clicked Sign in
  // from a public share page bounces back to that doc instead of
  // landing on a stranger's dashboard. Only same-origin paths are
  // allowed — never echo back an arbitrary URL or we have an open
  // redirect.
  const nextUrl = useMemo(() => {
    const raw = searchParams?.get("next");
    if (!raw) return "/dashboard";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
    return raw;
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && !isAnonymous) {
      router.replace(nextUrl);
    }
  }, [loading, user, isAnonymous, router, nextUrl]);

  // Handle the return half of the redirect-based sign-in path. When a
  // user signs in via signInWithRedirect / linkWithRedirect, the page
  // navigates to Google and back — getRedirectResult resolves on first
  // load with the resulting credential (or null if there's nothing to
  // process). Errors here are surfaced inline.
  //
  // Special case: if linkWithRedirect was attempted and Google is
  // already a separate Firebase user, getRedirectResult throws
  // auth/credential-already-in-use. We auto-recover by signing out the
  // anon and immediately redirecting to plain sign-in — the user
  // doesn't have to click again. The anon-session's docs orphan; the
  // claim flow on /edit/[token] is the recovery path.
  useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          router.replace(nextUrl);
        }
      } catch (e) {
        const fe = e as FirebaseError;
        if (fe.code === "auth/credential-already-in-use") {
          try {
            await signOut(auth);
            await signInWithRedirect(auth, new GoogleAuthProvider());
          } catch (e2) {
            const msg = friendlyError(e2);
            if (msg) setErr(msg);
          }
          return;
        }
        const msg = friendlyError(e);
        if (msg) setErr(msg);
      }
    })();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setBusy("google");
    setErr(null);
    setInfo(null);
    try {
      // Always use redirect, never popup. Popups silently fail on
      // browsers that block third-party cookies (Safari default,
      // Chrome incognito, Brave, hardened profiles) — the popup opens,
      // the user picks their account, the popup closes, and the
      // credential never propagates to Firebase. signInWithRedirect
      // routes through the firebaseapp.com domain as a top-level
      // navigation, which doesn't depend on third-party cookies.
      // Trade: ~0.5s slower UX (full page bounce) for reliability.
      // We sign out the anonymous session first because anon-link via
      // redirect can't recover gracefully from auth/credential-already-
      // in-use; the claim flow on /edit/[token] handles anon-doc
      // recovery if the user holds the editToken.
      if (auth.currentUser?.isAnonymous) {
        await signOut(auth).catch(() => undefined);
      }
      await signInWithRedirect(auth, new GoogleAuthProvider());
      // signInWithRedirect navigates away — no further code runs in
      // this tab until the user returns and getRedirectResult fires
      // in the mount effect above.
    } catch (e) {
      const msg = friendlyError(e);
      if (msg) setErr(msg);
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErr("Email and password required.");
      return;
    }
    setBusy("email");
    setErr(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        // Try to link to the anon UID first to preserve session docs.
        if (auth.currentUser?.isAnonymous) {
          try {
            const cred = EmailAuthProvider.credential(email, password);
            const linked = await linkWithCredential(auth.currentUser, cred);
            // Best-effort: send verification email; ignore failures.
            sendEmailVerification(linked.user).catch(() => undefined);
            router.replace(nextUrl);
            return;
          } catch (e2) {
            const fe = e2 as FirebaseError;
            if (fe.code !== "auth/email-already-in-use") throw e2;
            // Email is already taken — sign out anon and tell the user.
            await signOut(auth);
            setErr(
              "An account with this email already exists. Switch to Sign in.",
            );
            setMode("signin");
            return;
          }
        }
        const created = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        sendEmailVerification(created.user).catch(() => undefined);
        router.replace(nextUrl);
      } else {
        // Sign in. Sign out the anon session first since we can't link
        // an already-existing user; this session's anon docs orphan.
        if (auth.currentUser?.isAnonymous) await signOut(auth);
        await signInWithEmailAndPassword(auth, email, password);
        router.replace(nextUrl);
      }
    } catch (e) {
      const msg = friendlyError(e);
      if (msg) setErr(msg);
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setErr("Type your email above first, then click Forgot password.");
      return;
    }
    setBusy("reset");
    setErr(null);
    setInfo(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo(`Reset link sent to ${email}. Check your inbox.`);
    } catch (e) {
      const msg = friendlyError(e);
      if (msg) setErr(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full">
        <h1 className="mb-2 text-center text-2xl font-bold">
          Sign in or create your sendoc account
        </h1>
        <p className="mb-8 text-center text-sm text-gray-600">
          Manage the docs you&apos;ve published — edit, delete, take down
          any time.
        </p>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={!!busy}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
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
          {busy === "google" ? "Signing in…" : "Continue with Google"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          or
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Mode toggle */}
        <div className="mb-4 inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
          {(
            [
              { id: "signin", label: "Sign in" },
              { id: "signup", label: "Create account" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setErr(null);
                setInfo(null);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-center transition ${
                mode === m.id
                  ? "bg-white font-medium text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Email form */}
        <form onSubmit={handleEmail} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
              <span>Password</span>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!!busy}
                  className="text-xs font-normal text-brand hover:underline disabled:opacity-50"
                >
                  Forgot password?
                </button>
              )}
            </label>
            <input
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 6 : undefined}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {mode === "signup" && (
              <p className="mt-1 text-xs text-gray-500">
                At least 6 characters.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!!busy}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {busy === "email"
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
        {info && <p className="mt-4 text-sm text-emerald-700">{info}</p>}

        <p className="mt-10 text-center text-xs text-gray-400">
          Or{" "}
          <a
            href="/dashboard"
            className="underline underline-offset-2 hover:text-gray-700"
          >
            continue without signing in
          </a>
          .
        </p>
      </div>
    </main>
  );
}
