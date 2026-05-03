// GET /api/invite/[inviteToken]
//
// Public endpoint that returns metadata for an invite acceptance page:
// who invited, the doc title, the role granted, the expected email.
// Doesn't require auth — the token IS the auth here, similar to the
// edit-token model used everywhere else in sendoc.
//
// We return a small snapshot only — never the full doc content. Once
// the user signs in and accepts, /d/<shareToken> or /edit/<editToken>
// is what serves the doc.

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { lookupHashes } from "@/lib/secret-hash";

export const runtime = "nodejs";

const INVITE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteToken: string } },
) {
  const [newHash, oldHash] = lookupHashes(params.inviteToken);
  const snap = await adminDb()
    .collection("collaborators")
    .where("inviteTokenHash", "in", [newHash, oldHash])
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json(
      { error: "INVALID", message: "This invite link isn't valid." },
      { status: 404 },
    );
  }
  const collab = snap.docs[0].data();

  if (collab.status === "removed") {
    return NextResponse.json(
      {
        error: "REVOKED",
        message: "This invite was revoked by the doc owner.",
      },
      { status: 410 },
    );
  }

  // Expire invites that sit untouched for too long. Owners can re-invite.
  const invitedAtMs = collab.invitedAt?.toMillis?.() ?? 0;
  if (Date.now() - invitedAtMs > INVITE_MAX_AGE_MS) {
    return NextResponse.json(
      {
        error: "EXPIRED",
        message: "This invite has expired. Ask the owner to send a fresh one.",
      },
      { status: 410 },
    );
  }

  // Hydrate doc metadata for the preview.
  const docSnap = await adminDb()
    .collection("docs")
    .doc(collab.docId)
    .get();
  if (!docSnap.exists) {
    return NextResponse.json(
      { error: "DOC_GONE", message: "The doc this invite points to no longer exists." },
      { status: 410 },
    );
  }
  const doc = docSnap.data()!;
  if (doc.status !== "active") {
    return NextResponse.json(
      {
        error: "DOC_GONE",
        message: "The doc was deleted by its owner.",
      },
      { status: 410 },
    );
  }

  return NextResponse.json({
    docId: collab.docId,
    docTitle: doc.title || "Untitled",
    invitedEmail: collab.email,
    role: collab.role,
    invitedByEmail: collab.invitedByEmail ?? null,
    status: collab.status,
  });
}
