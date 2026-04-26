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
    .collection("adminAudits")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const audits = snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      action: data.action,
      actor: data.actor ?? null,
      target: data.target ?? null,
      reason: data.reason ?? null,
      diff: data.diff ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? null,
    };
  });

  return NextResponse.json({ audits });
}
