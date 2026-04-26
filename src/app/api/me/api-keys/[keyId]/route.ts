// DELETE /api/me/api-keys/[keyId] — revoke a key.
// Soft-delete: sets revokedAt. The key still exists in the audit trail
// but verification rejects it.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { keyId: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ref = adminDb().collection("apiKeys").doc(params.keyId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (snap.data()?.ownerId !== decoded.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ref.update({ revokedAt: new Date() });
  return NextResponse.json({ ok: true });
}
