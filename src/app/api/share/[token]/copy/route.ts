// POST /api/share/[token]/copy — fork a public doc into a new editable copy.
//
// Reads the doc by share token, then creates a brand-new doc with the same
// content, a fresh shareLink token, and a fresh editToken. Same flow as
// /api/publish — anonymous, rate-limited, moderated.

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { moderate } from "@/lib/moderation";
import { checkIpRateLimit } from "@/lib/rate-limit";

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
    hash: crypto.createHash("sha256").update(body).digest("hex"),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const ip = getClientIp(req);

  // Reuse the publish rate-limit bucket — copies are publishes by another name.
  const rl = await checkIpRateLimit(ip, "publish", 5, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "RATE_LIMIT",
        message: "Too many copies from this IP. Try again later.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 3600) } },
    );
  }

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
  const source = snap.docs[0].data();
  if (source.shareLink?.active === false || source.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content: string = source.content ?? "";
  if (!content) {
    return NextResponse.json(
      { error: "EMPTY_SOURCE", message: "Source doc has no content to copy." },
      { status: 400 },
    );
  }

  // Re-moderate the content — the source might have been published before
  // some classifier upgrade, or the source could be edge-case content
  // we want to re-screen on every fork.
  const check = await moderate(content, "output");
  if (check.flagged) {
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
  const title = `Copy of ${source.title ?? "Untitled"}`.slice(0, 200);

  await adminDb()
    .collection("docs")
    .doc(docId)
    .set({
      docId,
      title,
      ownerId: null, // anonymous copy — claimable later
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
        mode: "anonymous_copy",
        source: "copy",
        ip,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        copiedFrom: source.docId ?? null,
      },
    });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host")}`;

  return NextResponse.json(
    {
      docId,
      title,
      shareUrl: `${appUrl}/d/${linkToken}`,
      editUrl: `${appUrl}/edit/${editTok.plaintext}`,
      editToken: editTok.plaintext,
    },
    { status: 201 },
  );
}
