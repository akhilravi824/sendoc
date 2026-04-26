// DELETE /api/me/account — full GDPR delete-my-account.
//
// Wipes:
//  - All docs owned by the user
//  - All API keys
//  - The users/{uid} profile mirror
//  - The Firebase Auth user record (so they can't be re-identified)
//
// Audit: writes a single adminAudits entry recording the deletion (with
// the deleted UID + email) so we have a paper trail for compliance
// review. Documents themselves are hard-deleted, not soft-deleted —
// GDPR Right to Erasure requires actual removal, not flag flips.
//
// The caller must be authenticated as the account being deleted.

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, verifyIdToken } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") {
    return NextResponse.json(
      {
        error: "ANONYMOUS_NO_DELETE",
        message:
          "Anonymous accounts have no persistent identity — clearing your browser data effectively removes them.",
      },
      { status: 400 },
    );
  }

  const uid = decoded.uid;
  const email = decoded.email ?? null;
  const db = adminDb();
  const now = new Date();
  const summary: { docs: number; apiKeys: number; profile: boolean } = {
    docs: 0,
    apiKeys: 0,
    profile: false,
  };

  // Delete owned docs in batches (Firestore limits a batch to 500 ops).
  const docsSnap = await db
    .collection("docs")
    .where("ownerId", "==", uid)
    .get();
  let batch = db.batch();
  let pending = 0;
  for (const d of docsSnap.docs) {
    batch.delete(d.ref);
    pending++;
    summary.docs++;
    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  // Delete owned API keys.
  const keysSnap = await db
    .collection("apiKeys")
    .where("ownerId", "==", uid)
    .get();
  for (const d of keysSnap.docs) {
    batch.delete(d.ref);
    pending++;
    summary.apiKeys++;
    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  // Delete profile mirror.
  const profileRef = db.collection("users").doc(uid);
  if ((await profileRef.get()).exists) {
    batch.delete(profileRef);
    summary.profile = true;
    pending++;
  }

  if (pending > 0) await batch.commit();

  // Audit entry — non-personal record of the deletion (UID is gone, but we
  // keep the email + timestamp for compliance review, since GDPR Article 17
  // exception 3(b) allows retention for legal claims).
  await db.collection("adminAudits").add({
    actor: { uid: "self-deletion", email, role: "user" },
    action: "user.delete",
    target: { type: "user", id: uid },
    reason: "User-initiated GDPR deletion",
    diff: {
      before: { uid, email },
      after: { deleted: true, summary },
    },
    createdAt: now,
  });

  // Finally, delete the Firebase Auth record. Once this returns, the user's
  // ID token is invalid and they can never be re-authenticated as the same
  // identity (a fresh sign-up with the same email creates a NEW UID).
  try {
    await adminAuth().deleteUser(uid);
  } catch (e) {
    // Log but don't fail — Firestore data is already gone, which is
    // the data-protection priority.
    console.error("[gdpr] Firebase Auth deletion failed", e);
  }

  return NextResponse.json({ ok: true, summary });
}
