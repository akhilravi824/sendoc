// POST /api/edit/[editToken]/claim
//
// Lets a signed-in user attach an anonymous doc to their account by
// proving they hold the edit token. After claiming, the doc shows up in
// the user's dashboard and survives sign-out/clear-cookies on the
// device that originally published it.
//
// Rules:
// - Caller must hold a valid Firebase ID token AND not be anonymous
//   (anon users can't really "own" anything across devices).
// - The doc must currently be unowned (ownerId == null) OR already
//   owned by the same caller (idempotent).
// - Re-claiming someone else's doc is rejected with 409.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { lookupHashes, pepperedHash } from "@/lib/secret-hash";
import { logAction } from "@/lib/audit/action";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { editToken: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sign in to claim this doc." },
      { status: 401 },
    );
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") {
    return NextResponse.json(
      {
        error: "SIGN_IN_REQUIRED",
        message:
          "Anonymous accounts can't own docs. Sign in with Google first.",
      },
      { status: 403 },
    );
  }

  const [newHash, oldHash] = lookupHashes(params.editToken);
  const snap = await adminDb()
    .collection("docs")
    .where("editTokenHash", "in", [newHash, oldHash])
    .limit(1)
    .get();
  if (snap.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const docRef = snap.docs[0].ref;
  const doc = snap.docs[0].data();
  if (doc.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.ownerId && doc.ownerId !== decoded.uid) {
    return NextResponse.json(
      {
        error: "ALREADY_OWNED",
        message: "This doc is already owned by another account.",
      },
      { status: 409 },
    );
  }

  // Already mine — idempotent success.
  if (doc.ownerId === decoded.uid) {
    return NextResponse.json({ ok: true, alreadyOwned: true });
  }

  const update: Record<string, unknown> = {
    ownerId: decoded.uid,
    ownerEmail: decoded.email ?? null,
    updatedAt: new Date(),
  };
  // Opportunistic hash rotation while we're touching the doc.
  if (doc.editTokenHash !== newHash) {
    update.editTokenHash = pepperedHash(params.editToken);
  }
  await docRef.update(update);

  logAction({
    action: "doc.claim",
    actor: {
      type: "user",
      uid: decoded.uid,
      email: decoded.email ?? null,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    },
    docId: doc.docId,
    meta: { previousOwnerId: doc.ownerId ?? null },
  });

  return NextResponse.json({ ok: true });
}
