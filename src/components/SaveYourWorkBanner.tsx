"use client";

// Sits in the corner of the dashboard while the user is anonymous.
// Clicking "Save your work" calls linkWithPopup, which UPGRADES the
// existing anonymous Firebase account to a Google account — preserving
// the same UID. All the user's docs follow them automatically (Firestore
// rules use auth.uid which doesn't change).
//
// Edge case: if the Google account being linked is already a separate
// existing Firebase account (the user had previously signed in with that
// Google account on a different device), Firebase throws
// "auth/credential-already-in-use". We catch that and fall back to plain
// sign-in — at which point the anonymous docs are orphaned (this is the
// known trade-off of cross-device anonymous sessions).

import { useState } from "react";
import {
  linkWithPopup,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { type FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";

export function SaveYourWorkBanner() {
  const { user, isAnonymous } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user || !isAnonymous) return null;

  const handleSave = async () => {
    setBusy(true);
    setErr(null);
    try {
      await linkWithPopup(user, new GoogleAuthProvider());
      // Success — same UID, now backed by Google identity. No reload needed;
      // the AuthProvider's onAuthStateChanged will pick up isAnonymous=false.
    } catch (e) {
      const fe = e as FirebaseError;
      if (fe.code === "auth/credential-already-in-use") {
        // The Google account is already a Firebase user. Sign out anon, sign
        // in to the existing Google account. (Anon docs from this session are
        // orphaned — we'll add a "claim" flow in a later sprint.)
        try {
          await signOut(auth);
          await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (e2) {
          const fe2 = e2 as FirebaseError;
          setErr(fe2.message || "Sign-in failed");
        }
      } else if (fe.code === "auth/popup-closed-by-user") {
        // User just closed the popup — silent no-op.
      } else {
        setErr(fe.message || "Couldn't save your work");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="text-base">⚠️</span>
      <div className="flex-1">
        <p className="font-medium">Your docs are saved to this browser only.</p>
        <p className="text-xs text-amber-800">
          Sign in with Google to keep them safe and access them from any device.
        </p>
      </div>
      <button
        onClick={handleSave}
        disabled={busy}
        className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-50"
      >
        {busy ? "…" : "Save my work"}
      </button>
      {err && <p className="ml-2 text-xs text-red-700">{err}</p>}
    </div>
  );
}
