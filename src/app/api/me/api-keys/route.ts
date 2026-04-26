// Self-serve API key management. Auth: Firebase ID token (the user must
// be signed in to manage their own keys).
//
// GET  → list user's keys (without the plaintext token)
// POST → create a new key, returns plaintext ONCE

import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { generateApiKey } from "@/lib/api-key";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") {
    return NextResponse.json(
      { error: "SIGN_IN_REQUIRED", message: "Sign in with Google to manage API keys." },
      { status: 403 },
    );
  }

  const snap = await adminDb()
    .collection("apiKeys")
    .where("ownerId", "==", decoded.uid)
    .orderBy("createdAt", "desc")
    .get();

  const keys = snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      keyId: d.id,
      name: data.name,
      prefix: data.prefix,
      createdAt: data.createdAt?.toMillis?.() ?? null,
      lastUsedAt: data.lastUsedAt?.toMillis?.() ?? null,
      revokedAt: data.revokedAt?.toMillis?.() ?? null,
    };
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") {
    return NextResponse.json(
      { error: "SIGN_IN_REQUIRED", message: "Sign in with Google to create API keys." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = (typeof body.name === "string" ? body.name : "").trim().slice(0, 80) || "Untitled key";

  const { token, prefix, hash } = generateApiKey();
  const now = new Date();
  const ref = adminDb().collection("apiKeys").doc();
  await ref.set({
    keyId: ref.id,
    name,
    prefix,
    hash,
    ownerId: decoded.uid,
    ownerEmail: decoded.email ?? null,
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
  });

  // The token plaintext is returned ONCE. Never stored, never recoverable.
  return NextResponse.json({
    keyId: ref.id,
    name,
    prefix,
    token,
    createdAt: now.getTime(),
  });
}
