import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const { token } = params;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const snap = await adminDb()
    .collection("docs")
    .where("shareLink.token", "==", token)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = snap.docs[0].data();
  if (data.shareLink?.active === false || data.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    title: data.title ?? "Untitled",
    content: data.content ?? "",
    updatedAt: data.updatedAt?.toMillis?.() ?? null,
  });
}
