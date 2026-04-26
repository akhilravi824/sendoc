import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { checkIpRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(ip, "reports", 10, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many reports. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 3600) } },
    );
  }

  const { token, reason } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const snap = await adminDb()
    .collection("docs")
    .where("shareLink.token", "==", token)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const docId = snap.docs[0].id;

  let reporterUid: string | null = null;
  try {
    const decoded = await verifyIdToken(req.headers.get("authorization"));
    reporterUid = decoded.uid;
  } catch {
    // Anonymous reports are fine — admin can still review.
  }

  await adminDb().collection("reports").add({
    docId,
    shareToken: token,
    reason: typeof reason === "string" ? reason.slice(0, 500) : null,
    reporterUid,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
