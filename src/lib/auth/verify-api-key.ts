// Verifies an API key from a Bearer token, returns the owner UID.
// Throws "INVALID_API_KEY" on bad/missing/revoked keys.

import { adminDb } from "@/lib/firebase-admin";
import { extractBearerToken, isApiKey } from "../api-key";
import { lookupHashes, pepperedHash } from "../secret-hash";

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

  // Try the new peppered hash and the legacy SHA-256 hash in one query so
  // existing keys keep working through the rotation window.
  const [newHash, oldHash] = lookupHashes(token);
  const snap = await adminDb()
    .collection("apiKeys")
    .where("hash", "in", [newHash, oldHash])
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
  // Opportunistically rotate legacy hashes to the peppered version on use.
  const update: Record<string, unknown> = { lastUsedAt: new Date() };
  if (data.hash !== newHash) {
    update.hash = pepperedHash(token);
  }
  doc.ref.update(update).catch(() => undefined);

  return {
    uid: data.ownerId,
    keyId: doc.id,
    email: data.ownerEmail ?? null,
  };
}
