// Anonymous public publish endpoint. No auth required — anyone (or any
// AI agent: Claude, ChatGPT, etc.) can POST a document and get back a
// public share URL.
//
// Defenses:
// - Per-IP rate limit (5/hour). Heavy because there's no user to ban.
// - Content moderation on every publish. If flagged → 422.
// - Strong random edit token returned, lets the caller edit/delete later
//   without needing an account.
// - Admin can still take down via /admin (sets shareLink.active = false).
//
// Request:
//   POST /api/publish
//   Content-Type: application/json
//   { title?: string, content: string, source?: "claude" | "chatgpt" | string }
//
// Response (201):
//   {
//     docId, shareUrl, editToken,
//     title, source
//   }

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { moderate } from "@/lib/moderation";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { pepperedHash } from "@/lib/secret-hash";
import { logAction } from "@/lib/audit/action";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function generateEditToken(): { plaintext: string; hash: string } {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let body = "";
  for (let i = 0; i < 40; i++) {
    body += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return {
    plaintext: body,
    hash: pepperedHash(body),
  };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Per-IP rate limit. 5 publishes per hour per IP. Tight because there
  // is no user-level accountability for these docs.
  const rl = await checkIpRateLimit(ip, "publish", 5, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "RATE_LIMIT",
        message: "Too many publishes from this IP. Try again later.",
        retryAfter: rl.retryAfter,
      },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { title?: string; content?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json(
      { error: "MISSING_CONTENT", message: "`content` is required." },
      { status: 400 },
    );
  }
  if (content.length > 200_000) {
    return NextResponse.json(
      { error: "CONTENT_TOO_LARGE", message: "Content exceeds 200KB limit." },
      { status: 413 },
    );
  }

  // Content moderation. Anonymous docs MUST pass — no owner to ban if
  // someone abuses, so we lean harder on the classifier.
  const check = await moderate(content, "output");
  if (check.flagged) {
    await adminDb().collection("moderationFlags").add({
      docId: null,
      ownerId: null,
      source: "anonymous_publish",
      ip,
      category: check.category ?? null,
      sample: content.slice(0, 500),
      createdAt: new Date(),
    });
    return NextResponse.json(
      {
        error: "MODERATION_BLOCKED",
        message: "This content was blocked by our content policy.",
        category: check.category ?? null,
      },
      { status: 422 },
    );
  }

  const docId = uuidv4();
  const linkToken = uuidv4();
  const editTok = generateEditToken();
  const now = new Date();
  const title =
    (body.title ?? "").slice(0, 200).trim() ||
    content.slice(0, 60).replace(/\s+/g, " ").trim() ||
    "Untitled";
  const source =
    typeof body.source === "string" ? body.source.slice(0, 40) : null;

  await adminDb()
    .collection("docs")
    .doc(docId)
    .set({
      docId,
      title,
      ownerId: null, // anonymous — claimable later
      ownerEmail: null,
      content,
      contentSize: content.length,
      status: "active",
      createdAt: now,
      updatedAt: now,
      editTokenHash: editTok.hash,
      shareLink: {
        token: linkToken,
        ttl: null,
        createdAt: now,
        active: true,
      },
      meta: {
        aiModel: null,
        mode: "anonymous_publish",
        source,
        ip,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      },
    });

  logAction({
    action: "doc.publish",
    actor: {
      type: "anonymous",
      ip,
      userAgent: req.headers.get("user-agent"),
    },
    docId,
    meta: { source, contentSize: content.length },
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (req.headers.get("x-forwarded-proto") && req.headers.get("host")
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("host")}`
      : "");

  return NextResponse.json(
    {
      docId,
      title,
      source,
      shareUrl: `${appUrl}/d/${linkToken}`,
      editUrl: `${appUrl}/edit/${editTok.plaintext}`,
      editToken: editTok.plaintext,
    },
    { status: 201, headers: rateLimitHeaders(rl) },
  );
}
