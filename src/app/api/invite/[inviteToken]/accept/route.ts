// POST /api/invite/[inviteToken]/accept
//
// Signed-in user accepts an invite. The caller's auth email must
// match the invited email — otherwise we'd let anyone with the URL
// claim access, which defeats the identity-first model.
//
// On accept:
//   - Update collaborator status: "accepted", record acceptedByUid +
//     acceptedAt
//   - Audit log
//   - Return the doc's shareToken (and editToken-like access if role
//     is "editor") so the client can route to the right page

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { lookupHashes, pepperedHash } from "@/lib/secret-hash";
import { logAction } from "@/lib/audit/action";

export const runtime = "nodejs";

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { inviteToken: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sign in to accept the invite." },
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

  const callerEmail = normalizeEmail(decoded.email ?? "");
  if (!callerEmail) {
    return NextResponse.json(
      {
        error: "NO_EMAIL",
        message: "Your account doesn't have an email on file.",
      },
      { status: 400 },
    );
  }

  const [newHash, oldHash] = lookupHashes(params.inviteToken);
  const snap = await adminDb()
    .collection("collaborators")
    .where("inviteTokenHash", "in", [newHash, oldHash])
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "INVALID" }, { status: 404 });
  }
  const collabRef = snap.docs[0].ref;
  const collab = snap.docs[0].data();

  if (collab.status === "removed") {
    return NextResponse.json({ error: "REVOKED" }, { status: 410 });
  }

  if (normalizeEmail(collab.email) !== callerEmail) {
    return NextResponse.json(
      {
        error: "EMAIL_MISMATCH",
        message: `This invite is for ${collab.email}. Sign in with that account to accept.`,
      },
      { status: 403 },
    );
  }

  // Hydrate the doc to confirm it's still around and grab the share
  // token to return to the client.
  const docSnap = await adminDb()
    .collection("docs")
    .doc(collab.docId)
    .get();
  if (!docSnap.exists || docSnap.data()?.status !== "active") {
    return NextResponse.json({ error: "DOC_GONE" }, { status: 410 });
  }
  const doc = docSnap.data()!;

  // Mark the invite accepted (idempotent if already accepted).
  await collabRef.update({
    status: "accepted",
    acceptedAt: new Date(),
    acceptedByUid: decoded.uid,
    // Rotate the invite token so the URL can't be re-shared after
    // acceptance — defense against forwarded leaks.
    inviteTokenHash: pepperedHash(params.inviteToken + ":consumed"),
  });

  // Auto-add to the user's "Shared with me" feed. The accept fact
  // alone isn't enough — savedDocs is what the dashboard reads to
  // populate the filter, so we drop a row here so the doc appears
  // immediately on first dashboard load post-accept.
  if (doc.shareLink?.token) {
    const savedId = `${decoded.uid}_${collab.docId}`;
    await adminDb()
      .collection("savedDocs")
      .doc(savedId)
      .set(
        {
          uid: decoded.uid,
          docId: collab.docId,
          shareToken: doc.shareLink.token,
          title: doc.title ?? "Untitled",
          ownerEmail: doc.ownerEmail ?? null,
          sourceMode: "invite_accepted",
          savedAt: new Date(),
        },
        { merge: true },
      );
  }

  logAction({
    action: "doc.claim",
    actor: {
      type: "user",
      uid: decoded.uid,
      email: decoded.email ?? null,
    },
    docId: collab.docId,
    meta: {
      via: "invite_accept",
      role: collab.role,
    },
  });

  return NextResponse.json({
    ok: true,
    docId: collab.docId,
    role: collab.role,
    shareUrl: doc.shareLink?.token
      ? `/d/${doc.shareLink.token}`
      : `/doc/${collab.docId}`,
  });
}
