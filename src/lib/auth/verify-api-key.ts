// Verifies an API key from a Bearer token, returns the owner UID.
// Throws "INVALID_API_KEY" on bad/missing/revoked keys.

import { adminDb } from "@/lib/firebase-admin";
import { extractBearerToken, hashToken, isApiKey } from "../api-key";

export type ApiKeyAuth = {
  uid: string;
  keyId: string;
  email?: string | null;
};

export async function verifyApiKey(
  authorizationHeader: string | null,
): Promise<ApiKeyAuth> {
  const token = extractBearerToken(authorizationHeader);
  if (!token || !isApiKey(token)) {
    throw new Error("INVALID_API_KEY");
  }

  const hash = hashToken(token);
  const snap = await adminDb()
    .collection("apiKeys")
    .where("hash", "==", hash)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error("INVALID_API_KEY");
  }
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.revokedAt) {
    throw new Error("INVALID_API_KEY");
  }

  // Update lastUsedAt — fire-and-forget so we don't slow down the request.
  doc.ref
    .update({ lastUsedAt: new Date() })
    .catch(() => undefined);

  return {
    uid: data.ownerId,
    keyId: doc.id,
    email: data.ownerEmail ?? null,
  };
}
