// POST /api/share/[token]/save
// DELETE /api/share/[token]/save
//
// Lets a signed-in user "save" a share URL into their dashboard's
// "Shared with me" filter. Sendoc's sharing model is otherwise purely
// link-based — there's no notion of "shared WITH user X" by identity.
// This endpoint bridges that gap: anyone holding the share URL can,
// when signed in, claim a permanent slot in their own dashboard for it.
//
// Auth: Firebase ID token (anonymous users are rejected — anonymous
// dashboards already use the same UID across sessions only on one
// device, so a "saved" entry there would orphan immediately).
//
// Idempotent: doc ID is uid_docId, so re-saving is a no-op.
//
// We deliberately do NOT save when the doc already belongs to the
// caller (`ownerId === uid`) — it's already in their "All / Live"
// filter, no need for a duplicate entry.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { isExpired } from "@/lib/link-ttl";

export const runtime = "nodejs";

function savedDocId(uid: string, docId: string): string {
  // Firestore doc IDs can contain alphanumerics, _, and -, which both
  // UIDs and our UUID docIds satisfy already.
  return `${uid}_${docId}`;
}

async function findDocByShareToken(token: string) {
  const snap = await adminDb()
    .collection("docs")
    .where("shareLink.token", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sign in to save docs." },
      { status: 401 },
    );
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") {
    return NextResponse.json(
      {
        error: "SIGN_IN_REQUIRED",
        message: "Sign in with Google or email first.",
      },
      { status: 403 },
    );
  }

  const found = await findDocByShareToken(params.token);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    found.data.shareLink?.active === false ||
    found.data.status !== "active"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isExpired(found.data)) {
    return NextResponse.json(
      { error: "EXPIRED", message: "This share link has expired." },
      { status: 410 },
    );
  }

  // Already-mine guard: nothing to save, but report success so the
  // client can hide the button without an error.
  if (found.data.ownerId && found.data.ownerId === decoded.uid) {
    return NextResponse.json({ ok: true, alreadyOwned: true });
  }

  const id = savedDocId(decoded.uid, found.data.docId);
  const now = new Date();

  await adminDb()
    .collection("savedDocs")
    .doc(id)
    .set(
      {
        uid: decoded.uid,
        docId: found.data.docId,
        shareToken: params.token,
        title: found.data.title ?? "Untitled",
        ownerEmail: found.data.ownerEmail ?? null,
        sourceMode: found.data.meta?.mode ?? null,
        savedAt: now,
      },
      { merge: true },
    );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const found = await findDocByShareToken(params.token);
  if (!found) {
    // Silently succeed — nothing to remove.
    return NextResponse.json({ ok: true });
  }
  await adminDb()
    .collection("savedDocs")
    .doc(savedDocId(decoded.uid, found.data.docId))
    .delete()
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
