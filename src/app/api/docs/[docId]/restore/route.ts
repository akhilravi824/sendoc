// POST /api/docs/[docId]/restore
//
// Reverses a soft delete within the 7-day grace window. After purgeAt,
// the doc's content is wiped by a background job and the row is
// "permanently" gone — restore from there returns 410 GONE.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { logAction } from "@/lib/audit/action";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { docId: string } },
) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ref = adminDb().collection("docs").doc(params.docId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data = snap.data()!;
  if (!data.ownerId || data.ownerId !== decoded.uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (data.status === "active") {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }
  if (data.status === "purged") {
    return NextResponse.json(
      {
        error: "GONE",
        message:
          "This doc was purged after the 7-day grace window and can't be restored.",
      },
      { status: 410 },
    );
  }

  const purgeAt = data.purgeAt?.toMillis?.() ?? null;
  if (purgeAt && Date.now() > purgeAt) {
    return NextResponse.json(
      {
        error: "GONE",
        message: "Grace window expired — the doc will be purged shortly.",
      },
      { status: 410 },
    );
  }

  await ref.update({
    status: "active",
    "shareLink.active": true,
    deletedAt: null,
    purgeAt: null,
    updatedAt: new Date(),
  });

  logAction({
    action: "doc.restore",
    actor: {
      type: "user",
      uid: decoded.uid,
      email: decoded.email ?? null,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    },
    docId: data.docId,
  });

  return NextResponse.json({ ok: true });
}
