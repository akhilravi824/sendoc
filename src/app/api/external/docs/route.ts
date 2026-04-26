// External "publish" endpoint — called by Claude MCP servers, ChatGPT
// Custom GPTs, scripts, or any HTTP client with a sendoc API key.
//
// Auth: Authorization: Bearer sk_sendoc_<key>
//
// Request:
//   POST /api/external/docs
//   Content-Type: application/json
//   { title?: string, content: string }
//
// Response:
//   201 { docId, shareUrl, title }
//   401 { error: "INVALID_API_KEY" }
//   422 { error: "MODERATION_BLOCKED", category }
//   429 { error: "RATE_LIMIT" }

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/firebase-admin";
import { verifyApiKey } from "@/lib/auth/verify-api-key";
import { moderate } from "@/lib/moderation";
import { checkAndIncrementRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await verifyApiKey(req.headers.get("authorization"));
  } catch {
    return NextResponse.json(
      { error: "INVALID_API_KEY", message: "Missing or invalid API key." },
      { status: 401 },
    );
  }

  let body: { title?: string; content?: string };
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

  // Per-owner rate limit. The connector inherits the owner's daily quota
  // (anon = 5, signed-in = 25) so a leaked API key can't run wild.
  // External keys are always treated as "signed in" since you have to be
  // signed in to generate one.
  const rl = await checkAndIncrementRateLimit(auth.uid, false);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "RATE_LIMIT",
        message: `Daily limit of ${rl.limit} reached. Resets at ${rl.resetAt.toUTCString()}.`,
        resetAt: rl.resetAt.toISOString(),
      },
      { status: 429 },
    );
  }

  // Moderate the content — the AI agent generated it, but we still don't
  // want unsafe content propagating through our share links.
  const check = await moderate(content, "output");
  if (check.flagged) {
    await adminDb().collection("moderationFlags").add({
      docId: null,
      ownerId: auth.uid,
      source: "external_publish",
      keyId: auth.keyId,
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
  const now = new Date();
  const title =
    (body.title ?? "").slice(0, 200).trim() ||
    content.slice(0, 60).replace(/\s+/g, " ").trim() ||
    "Untitled";

  await adminDb()
    .collection("docs")
    .doc(docId)
    .set({
      docId,
      title,
      ownerId: auth.uid,
      ownerEmail: auth.email,
      content,
      contentSize: content.length,
      status: "active",
      createdAt: now,
      updatedAt: now,
      shareLink: {
        token: linkToken,
        ttl: null,
        createdAt: now,
        active: true,
      },
      meta: {
        aiModel: null,
        mode: "external_publish",
        wordCount: content.split(/\s+/).filter(Boolean).length,
        publishedVia: { keyId: auth.keyId },
      },
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
      shareUrl: `${appUrl}/d/${linkToken}`,
    },
    { status: 201 },
  );
}
