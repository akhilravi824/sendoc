// Firebase Admin SDK initialization (server-side only).
// Used by API routes to verify ID tokens and to write privileged data
// (e.g. audit logs that bypass client security rules).

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // The private key has literal "\n" sequences in the env var — restore real newlines.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Check FIREBASE_ADMIN_* vars in .env.local",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminAuth = (): Auth => getAuth(getAdminApp());
export const adminDb = (): Firestore => getFirestore(getAdminApp());

// Verify a Firebase ID token (passed as `Authorization: Bearer <token>`)
// and return the decoded user. Throws if invalid/expired.
export async function verifyIdToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("MISSING_TOKEN");
  }
  const token = authorizationHeader.slice("Bearer ".length);
  return adminAuth().verifyIdToken(token);
}
