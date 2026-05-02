// Identity-gated doc operations for signed-in owners.
//
// The token-gated routes (/api/edit/[editToken]) require the editToken
// — fine for connector flows where the AI agent has it. But once a
// doc has an ownerId, the owner can be missing the editToken (lost it,
// closed the chat, etc.) yet still expect to manage their own doc from
// the dashboard. This module provides that path.
//
// Auth: Firebase ID token. The doc must have ownerId === decoded.uid.
// Anonymous (unowned) docs cannot be touched here — they need either
// the editToken or a claim first.
//
// Endpoints:
//   PATCH  /api/docs/[docId]   → update title / content
//   DELETE /api/docs/[docId]   → soft delete (status: "removed")

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { moderate } from "@/lib/moderation";
import { logAction } from "@/lib/audit/action";
import { isExpired } from "@/lib/link-ttl";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function requireOwner(req: NextRequest, docId: string) {
  const decoded = await verifyIdToken(req.headers.get("authorization"));
  const ref = adminDb().collection("docs").doc(docId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("NOT_FOUND");
  const data = snap.data()!;
  if (!data.ownerId || data.ownerId !== decoded.uid) {
    throw new Error("FORBIDDEN");
  }
  return { ref, data, decoded };
}

function errorFor(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "NOT_FOUND") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (msg === "FORBIDDEN") {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "You don't own this doc, or it has no owner yet.",
      },
      { status: 403 },
    );
  }
  if (msg === "MISSING_TOKEN" || msg.includes("verify")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "INTERNAL", message: msg || "Unknown error" },
    { status: 500 },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { docId: string } },
) {
  let owner;
  try {
    owner = await requireOwner(req, params.docId);
  } catch (e) {
    return errorFor(e);
  }
  if (owner.data.status !== "active") {
    return NextResponse.json(
      { error: "REMOVED", message: "Restore the doc first to edit it." },
      { status: 409 },
    );
  }
  if (isExpired(owner.data)) {
    // Owned docs shouldn't expire today, but defend anyway.
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
    update.title = body.title.slice(0, 200).trim() || owner.data.title;
  }
  if (typeof body.content === "string") {
    if (body.content.length > 200_000) {
      return NextResponse.json(
        { error: "CONTENT_TOO_LARGE" },
        { status: 413 },
      );
    }
    const check = await moderate(body.content, "output");
    if (check.flagged) {
      const ip = getClientIp(req);
      await adminDb().collection("moderationFlags").add({
        docId: owner.data.docId,
        ownerId: owner.data.ownerId ?? null,
        source: "owner_edit",
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

  await owner.ref.update(update);

  logAction({
    action: "doc.edit",
    actor: {
      type: "user",
      uid: owner.decoded.uid,
      email: owner.decoded.email ?? null,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    },
    docId: owner.data.docId,
    meta: {
      titleChanged: typeof body.title === "string",
      contentChanged: typeof body.content === "string",
      via: "owner_dashboard",
    },
  });

  return NextResponse.json({ ok: true, updatedAt: Date.now() });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { docId: string } },
) {
  let owner;
  try {
    owner = await requireOwner(req, params.docId);
  } catch (e) {
    return errorFor(e);
  }
  if (owner.data.status !== "active") {
    // Already removed — idempotent success.
    return NextResponse.json({ ok: true, alreadyRemoved: true });
  }

  const now = new Date();
  // 7-day grace window before content is purged. Restore endpoint flips
  // status back; a future cron purges content past purgeAt.
  const purgeAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await owner.ref.update({
    status: "removed",
    "shareLink.active": false,
    deletedAt: now,
    purgeAt,
    updatedAt: now,
  });

  logAction({
    action: "doc.delete",
    actor: {
      type: "user",
      uid: owner.decoded.uid,
      email: owner.decoded.email ?? null,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    },
    docId: owner.data.docId,
    meta: { via: "owner_dashboard", purgeAt: purgeAt.toISOString() },
  });

  return NextResponse.json({ ok: true, purgeAt: purgeAt.toISOString() });
}
