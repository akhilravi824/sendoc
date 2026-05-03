// GET /api/share/[token]/save/status
//
// Tells the share page whether the current signed-in user has already
// saved this doc. Used to render "Save" vs "Saved" on first paint.
// No auth → returns saved: false (the share page just hides the button).

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ saved: false, signedIn: false });
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") {
    return NextResponse.json({ saved: false, signedIn: false });
  }

  // Resolve the doc by token first so we can build the savedDocs key.
  const docSnap = await adminDb()
    .collection("docs")
    .where("shareLink.token", "==", params.token)
    .limit(1)
    .get();
  if (docSnap.empty) {
    return NextResponse.json({ saved: false, signedIn: true });
  }
  const data = docSnap.docs[0].data();

  // Already-owned docs don't need saving.
  if (data.ownerId === decoded.uid) {
    return NextResponse.json({
      saved: false,
      signedIn: true,
      ownedBySelf: true,
    });
  }

  const id = `${decoded.uid}_${data.docId}`;
  const saved = (await adminDb().collection("savedDocs").doc(id).get()).exists;
  return NextResponse.json({ saved, signedIn: true });
}
