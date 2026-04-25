import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/admin";
import { logAdminAction } from "@/lib/auth/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let actor;
  try {
    actor = await requireRole(req.headers.get("authorization"), [
      "moderator",
      "admin",
      "super_admin",
    ]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    const code = msg === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: msg || "Unauthorized" }, { status: code });
  }

  const { docId, reason, restore } = await req.json();
  if (!docId) {
    return NextResponse.json({ error: "docId required" }, { status: 400 });
  }

  const docRef = adminDb().collection("docs").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const before = snap.data();

  const now = new Date();
  await docRef.update({
    "shareLink.active": !restore,
    status: restore ? "active" : "removed",
    updatedAt: now,
  });

  await logAdminAction({
    actor: { uid: actor.uid, email: actor.email, role: actor.role },
    action: restore ? "doc.restore" : "doc.takedown",
    target: { type: "doc", id: docId },
    reason: reason ?? null,
    diff: {
      before: { status: before?.status, shareActive: before?.shareLink?.active },
      after: { status: restore ? "active" : "removed", shareActive: !restore },
    },
  });

  return NextResponse.json({ ok: true, action: restore ? "restore" : "takedown" });
}
