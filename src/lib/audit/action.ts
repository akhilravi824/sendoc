// Per-action audit log. Records every doc.* event so admins (and
// partners reviewing our compliance posture) can reconstruct exactly
// what happened to any given doc and who did it.
//
// The shape mirrors `adminAudits` but with a different actor model:
// admins act through Firebase ID tokens; doc actions can come from
// anonymous IPs, signed-in users, or API keys, so the actor type is
// captured explicitly.
//
// Logging is fire-and-forget. We never want a Firestore hiccup to
// fail an otherwise-successful publish or edit.

import { adminDb } from "@/lib/firebase-admin";

export type ActionAuditActor =
  | { type: "anonymous"; ip?: string | null; userAgent?: string | null }
  | {
      type: "user";
      uid: string;
      email?: string | null;
      ip?: string | null;
      userAgent?: string | null;
    }
  | {
      type: "api_key";
      uid: string;
      email?: string | null;
      keyId: string;
      ip?: string | null;
      userAgent?: string | null;
    };

export type ActionAuditAction =
  | "doc.publish"
  | "doc.edit"
  | "doc.delete"
  | "doc.restore"
  | "doc.copy"
  | "doc.ai_edit"
  | "doc.claim"
  | "doc.share";

export function logAction(params: {
  action: ActionAuditAction;
  actor: ActionAuditActor;
  docId: string;
  meta?: Record<string, unknown>;
}): void {
  // Fire-and-forget. A logging failure must never fail the request.
  adminDb()
    .collection("actionAudits")
    .add({
      action: params.action,
      actor: params.actor,
      target: { type: "doc", id: params.docId },
      meta: params.meta ?? null,
      createdAt: new Date(),
    })
    .catch(() => undefined);
}
