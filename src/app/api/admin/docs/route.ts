import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req.headers.get("authorization"), [
      "moderator",
      "admin",
      "super_admin",
    ]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    const code = msg === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: msg || "Unauthorized" }, { status: code });
  }

  const snap = await adminDb()
    .collection("docs")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const docs = snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      docId: data.docId,
      title: data.title,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail ?? null,
      status: data.status,
      shareActive: data.shareLink?.active ?? false,
      shareToken: data.shareLink?.token ?? null,
      contentSize: data.contentSize ?? 0,
      createdAt: data.createdAt?.toMillis?.() ?? null,
      updatedAt: data.updatedAt?.toMillis?.() ?? null,
    };
  });

  const reportsSnap = await adminDb()
    .collection("reports")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const reports = reportsSnap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      docId: data.docId,
      reason: data.reason ?? null,
      reporterUid: data.reporterUid ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? null,
    };
  });

  const stats = {
    total: docs.length,
    active: docs.filter((d: { status: string; shareActive: boolean }) => d.status === "active" && d.shareActive).length,
    removed: docs.filter((d: { status: string; shareActive: boolean }) => d.status !== "active" || !d.shareActive).length,
    pendingReports: reports.length,
  };

  return NextResponse.json({ docs, reports, stats });
}
