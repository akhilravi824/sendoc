// Per-doc collaborator management.
//
// POST   /api/docs/[docId]/collaborators  — owner invites by email
// GET    /api/docs/[docId]/collaborators  — owner lists current invites
//
// Auth: Firebase ID token, must be the doc owner. Anonymous and
// non-owner accounts are rejected.
//
// Invite shape: each invite is a row in the top-level `collaborators`
// collection keyed by an internal id. The doc itself doesn't carry the
// list — that keeps doc reads cheap and lets us index collaborators by
// email for the invitee's "Shared with me" feed.
//
// Auto-resend / dedup: if an active invite already exists for the
// same email, we just refresh its `invitedAt` and re-send the email.
// No duplicate rows.

import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { pepperedHash } from "@/lib/secret-hash";
import { logAction } from "@/lib/audit/action";
import { sendInviteEmail, isResendConfigured } from "@/lib/email";

export const runtime = "nodejs";

type Role = "viewer" | "editor";

function inviteUrl(token: string, req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  return `${base}/invite/${token}`;
}

function genInviteToken(): { plaintext: string; hash: string } {
  // 40 chars of base32 entropy. Same shape as edit tokens.
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let body = "";
  for (let i = 0; i < 40; i++) {
    body += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return { plaintext: body, hash: pepperedHash(body) };
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
  if (msg === "NOT_FOUND")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg === "FORBIDDEN")
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "You don't own this doc.",
      },
      { status: 403 },
    );
  if (msg === "MISSING_TOKEN" || msg.includes("verify"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    { error: "INTERNAL", message: msg || "Unknown error" },
    { status: 500 },
  );
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function isValidEmail(s: string): boolean {
  // Pragmatic regex — RFC-perfect parsing isn't useful here.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { docId: string } },
) {
  let owner;
  try {
    owner = await requireOwner(req, params.docId);
  } catch (e) {
    return errorFor(e);
  }

  let body: { email?: string; role?: Role };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const email = normalizeEmail(body.email ?? "");
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "INVALID_EMAIL", message: "Enter a valid email address." },
      { status: 400 },
    );
  }
  const role: Role = body.role === "viewer" ? "viewer" : "editor";

  // Block self-invites — silly but easy mistake.
  if (owner.decoded.email && normalizeEmail(owner.decoded.email) === email) {
    return NextResponse.json(
      {
        error: "SELF_INVITE",
        message: "You can't invite your own email — you already own the doc.",
      },
      { status: 400 },
    );
  }

  // Dedup: if an active invite (pending or accepted) already exists for
  // this docId+email pair, refresh it instead of creating a second row.
  const existing = await adminDb()
    .collection("collaborators")
    .where("docId", "==", params.docId)
    .where("email", "==", email)
    .limit(1)
    .get();

  let collaboratorId: string;
  let inviteToken: string;
  let isNew: boolean;

  const now = new Date();
  if (!existing.empty) {
    // Re-send: keep the existing record, regenerate the token so the
    // old invite URL stops working (defense against forwarded leaks).
    const docRef = existing.docs[0].ref;
    const data = existing.docs[0].data();
    if (data.status === "removed") {
      // Re-activate a previously-removed invite by issuing a fresh row.
      collaboratorId = uuidv4();
      const tok = genInviteToken();
      inviteToken = tok.plaintext;
      isNew = true;
      await adminDb().collection("collaborators").doc(collaboratorId).set({
        collaboratorId,
        docId: params.docId,
        email,
        role,
        status: "pending",
        invitedBy: owner.decoded.uid,
        invitedByEmail: owner.decoded.email ?? null,
        invitedAt: now,
        acceptedAt: null,
        acceptedByUid: null,
        inviteTokenHash: tok.hash,
      });
    } else {
      const tok = genInviteToken();
      inviteToken = tok.plaintext;
      collaboratorId = data.collaboratorId ?? docRef.id;
      isNew = false;
      await docRef.update({
        role, // refresh role on re-invite — owner may have bumped it
        status: data.status === "accepted" ? "accepted" : "pending",
        invitedAt: now,
        inviteTokenHash: tok.hash,
      });
    }
  } else {
    collaboratorId = uuidv4();
    const tok = genInviteToken();
    inviteToken = tok.plaintext;
    isNew = true;
    await adminDb().collection("collaborators").doc(collaboratorId).set({
      collaboratorId,
      docId: params.docId,
      email,
      role,
      status: "pending",
      invitedBy: owner.decoded.uid,
      invitedByEmail: owner.decoded.email ?? null,
      invitedAt: now,
      acceptedAt: null,
      acceptedByUid: null,
      inviteTokenHash: tok.hash,
    });
  }

  // Audit
  logAction({
    action: "doc.edit", // re-using the closest existing action label
    actor: {
      type: "user",
      uid: owner.decoded.uid,
      email: owner.decoded.email ?? null,
    },
    docId: params.docId,
    meta: {
      via: "invite",
      invited: email,
      role,
      isNew,
    },
  });

  // Send the email (or fall back to URL-only response if Resend isn't
  // configured yet).
  const url = inviteUrl(inviteToken, req);
  const emailResult = await sendInviteEmail({
    to: email,
    inviterEmail: owner.decoded.email ?? "someone",
    docTitle: owner.data.title || "Untitled",
    role,
    inviteUrl: url,
  });

  return NextResponse.json({
    ok: true,
    collaboratorId,
    inviteUrl: url,
    emailSent: emailResult.sent,
    resendConfigured: isResendConfigured(),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { docId: string } },
) {
  let owner;
  try {
    owner = await requireOwner(req, params.docId);
  } catch (e) {
    return errorFor(e);
  }

  const snap = await adminDb()
    .collection("collaborators")
    .where("docId", "==", params.docId)
    .orderBy("invitedAt", "desc")
    .get();

  // Owner identity is captured in the closure above; we don't return
  // the inviteTokenHash to the client (server-only secret).
  const collaborators = snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      collaboratorId: data.collaboratorId ?? d.id,
      email: data.email,
      role: data.role,
      status: data.status,
      invitedAt: data.invitedAt?.toMillis?.() ?? null,
      acceptedAt: data.acceptedAt?.toMillis?.() ?? null,
    };
  });
  void owner; // tag-only use; lint quieting

  return NextResponse.json({ collaborators });
}
