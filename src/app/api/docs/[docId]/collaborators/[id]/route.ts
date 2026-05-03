// DELETE /api/docs/[docId]/collaborators/[id]
//
// Owner removes a collaborator. The row is marked status:"removed"
// rather than hard-deleted so the audit trail stays intact (we want
// to be able to answer "who had access on Jan 4 at 3pm" later).
// On the invitee side, the dashboard treats "removed" the same as
// "no row at all" — the doc simply disappears from their list.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { logAction } from "@/lib/audit/action";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { docId: string; id: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the caller owns the doc the collaborator belongs to.
  const docRef = adminDb().collection("docs").doc(params.docId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const docData = docSnap.data()!;
  if (!docData.ownerId || docData.ownerId !== decoded.uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const collabRef = adminDb().collection("collaborators").doc(params.id);
  const collabSnap = await collabRef.get();
  if (!collabSnap.exists) {
    return NextResponse.json({ ok: true, alreadyRemoved: true });
  }
  const collab = collabSnap.data()!;
  if (collab.docId !== params.docId) {
    // Defense in depth — id-doc mismatch shouldn't happen via the UI
    // but reject in case someone hand-crafts a request.
    return NextResponse.json({ error: "MISMATCH" }, { status: 400 });
  }

  await collabRef.update({
    status: "removed",
    removedAt: new Date(),
    removedBy: decoded.uid,
  });

  logAction({
    action: "doc.edit",
    actor: {
      type: "user",
      uid: decoded.uid,
      email: decoded.email ?? null,
    },
    docId: params.docId,
    meta: {
      via: "invite_remove",
      removedEmail: collab.email,
    },
  });

  return NextResponse.json({ ok: true });
}
