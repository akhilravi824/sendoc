"use client";

// Hybrid auth model:
// - Every visitor is automatically signed in *anonymously* on first load.
//   They get a real Firebase UID with no friction — same UX as ngrok.
// - They can later "Save your work" by upgrading the anonymous account
//   to Google with linkWithPopup (handled by SaveYourWorkBanner).
// - All UIDs (anon or Google) work identically with Firestore rules and
//   our backend's verifyIdToken — no special-casing needed.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Role = "user" | "moderator" | "admin" | "super_admin";

type AuthState = {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  /** True when the visitor has not yet upgraded to a Google account. */
  isAnonymous: boolean;
  /** Custom claim — null until token resolves, then "user" by default. */
  role: Role | null;
  refreshToken: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  idToken: null,
  loading: true,
  isAnonymous: true,
  role: null,
  refreshToken: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("[sendoc] anonymous sign-in failed", e);
          setLoading(false);
        }
        return;
      }
      setUser(u);
      const result = await u.getIdTokenResult();
      setIdToken(result.token);
      setRole(((result.claims.role as Role | undefined) ?? "user") as Role);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Refresh the ID token every 50 minutes (Firebase tokens last 60).
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const result = await user.getIdTokenResult(true);
      setIdToken(result.token);
      setRole(((result.claims.role as Role | undefined) ?? "user") as Role);
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const refreshToken = async () => {
    if (!user) return;
    const result = await user.getIdTokenResult(true);
    setIdToken(result.token);
    setRole(((result.claims.role as Role | undefined) ?? "user") as Role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        loading,
        isAnonymous: user?.isAnonymous ?? true,
        role,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
