// Firebase client SDK initialization (browser-side).
// Used by AuthProvider, DocEditor, dashboard — anywhere we need to read
// the user's identity or directly read/write Firestore docs they own.
//
// Lazy init: we don't call initializeApp() at module load time. That
// matters during Vercel's build step, where pages are prerendered as
// HTML in a Node environment that may or may not have NEXT_PUBLIC_*
// env vars available. If we initialized eagerly, a missing var would
// throw `auth/invalid-api-key` and crash the build.
//
// Proxies defer real init until the first method call (which only
// happens at runtime in the browser, when env vars are guaranteed).

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

function makeLazy<T extends object>(getReal: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = getReal();
      const value = (real as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}

export const auth: Auth = makeLazy<Auth>(() => {
  if (!_auth) _auth = getAuth(ensureApp());
  return _auth;
});

export const db: Firestore = makeLazy<Firestore>(() => {
  if (!_db) _db = getFirestore(ensureApp());
  return _db;
});

export const googleProvider = makeLazy<GoogleAuthProvider>(
  () => new GoogleAuthProvider(),
);
