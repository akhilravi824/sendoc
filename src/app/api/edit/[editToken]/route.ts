// Token-gated public edit endpoint. No sign-in required — anyone holding
// the editToken can read or modify the doc.
//
// GET    /api/edit/[editToken] → { docId, title, content, shareUrl, source }
// PATCH  /api/edit/[editToken] → updates title and/or content
// DELETE /api/edit/[editToken] → soft-removes the doc
//
// editToken is the plaintext returned by /api/publish at creation time.
// The server stores HMAC-SHA-256(API_KEY_PEPPER, token), compares hashes,
// never the plaintext. See src/lib/secret-hash.ts.

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { moderate } from "@/lib/moderation";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { lookupHashes, pepperedHash } from "@/lib/secret-hash";
import { logAction } from "@/lib/audit/action";
import { expiryFor, isExpired } from "@/lib/link-ttl";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function findDocByEditToken(editToken: string) {
  const [newHash, oldHash] = lookupHashes(editToken);
  const snap = await adminDb()
    .collection("docs")
    .where("editTokenHash", "in", [newHash, oldHash])
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  // Opportunistically rotate legacy hashes so the migration completes
  // organically as docs are touched.
  if (data.editTokenHash !== newHash) {
    doc.ref
      .update({ editTokenHash: pepperedHash(editToken) })
      .catch(() => undefined);
  }
  return { ref: doc.ref, data };
}

function getAppUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host")}`
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { editToken: string } },
) {
  const found = await findDocByEditToken(params.editToken);
  if (!found || found.data.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isExpired(found.data)) {
    return NextResponse.json(
      {
        error: "EXPIRED",
        message:
          "This edit link has expired. Anonymous docs are removed after 7 days unless claimed.",
      },
      { status: 410 },
    );
  }
  const appUrl = getAppUrl(req);
  return NextResponse.json({
    docId: found.data.docId,
    title: found.data.title,
    content: found.data.content,
    shareUrl: `${appUrl}/d/${found.data.shareLink?.token ?? ""}`,
    source: found.data.meta?.source ?? null,
    updatedAt: found.data.updatedAt?.toMillis?.() ?? null,
    ownerId: found.data.ownerId ?? null,
    ownerEmail: found.data.ownerEmail ?? null,
    expiresAt: expiryFor(found.data),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { editToken: string } },
) {
  // Per-IP edit rate limit. Generous — edits are normal — but stops
  // a leaked editToken from being scripted into 10k writes.
  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(ip, "edit", 60, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "RATE_LIMIT", retryAfter: rl.retryAfter },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const found = await findDocByEditToken(params.editToken);
  if (!found || found.data.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isExpired(found.data)) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  }

  let body: { title?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") {
    update.title = body.title.slice(0, 200).trim() || found.data.title;
  }
  if (typeof body.content === "string") {
    if (body.content.length > 200_000) {
      return NextResponse.json(
        { error: "CONTENT_TOO_LARGE" },
        { status: 413 },
      );
    }
    // Re-moderate edits — someone could publish clean content, then edit
    // in harmful content via the editToken.
    const check = await moderate(body.content, "output");
    if (check.flagged) {
      await adminDb().collection("moderationFlags").add({
        docId: found.data.docId,
        ownerId: found.data.ownerId ?? null,
        source: "edit",
        ip,
        category: check.category ?? null,
        sample: body.content.slice(0, 500),
        createdAt: new Date(),
      });
      return NextResponse.json(
        {
          error: "MODERATION_BLOCKED",
          message: "This edit was blocked by our content policy.",
          category: check.category ?? null,
        },
        { status: 422 },
      );
    }
    update.content = body.content;
    update.contentSize = body.content.length;
  }

  await found.ref.update(update);

  // Build a per-edit actor based on what we know. If a doc has an
  // ownerId, attribute the edit to that user; otherwise it's anonymous.
  const ownerUid = found.data.ownerId ?? null;
  logAction({
    action: "doc.edit",
    actor: ownerUid
      ? {
          type: "user",
          uid: ownerUid,
          email: found.data.ownerEmail ?? null,
          ip,
          userAgent: req.headers.get("user-agent"),
        }
      : { type: "anonymous", ip, userAgent: req.headers.get("user-agent") },
    docId: found.data.docId,
    meta: {
      titleChanged: typeof body.title === "string",
      contentChanged: typeof body.content === "string",
      contentSize:
        typeof body.content === "string" ? body.content.length : null,
    },
  });
  return NextResponse.json({ ok: true, updatedAt: Date.now() });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { editToken: string } },
) {
  const found = await findDocByEditToken(params.editToken);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await found.ref.update({
    status: "removed",
    "shareLink.active": false,
    updatedAt: new Date(),
  });
  const ip = getClientIp(req);
  const ownerUid = found.data.ownerId ?? null;
  logAction({
    action: "doc.delete",
    actor: ownerUid
      ? {
          type: "user",
          uid: ownerUid,
          email: found.data.ownerEmail ?? null,
          ip,
          userAgent: req.headers.get("user-agent"),
        }
      : { type: "anonymous", ip, userAgent: req.headers.get("user-agent") },
    docId: found.data.docId,
  });
  return NextResponse.json({ ok: true });
}
