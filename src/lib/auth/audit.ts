import { adminDb } from "@/lib/firebase-admin";
import type { Role } from "./claims";

type Actor = { uid: string; email?: string | null; role: Role };
type Target = { type: "doc" | "user" | "report"; id: string };

export type AuditAction =
  | "doc.takedown"
  | "doc.restore"
  | "user.grantRole"
  | "user.revokeRole";

export async function logAdminAction(params: {
  actor: Actor;
  action: AuditAction;
  target: Target;
  reason?: string | null;
  diff?: { before?: unknown; after?: unknown } | null;
}) {
  await adminDb()
    .collection("adminAudits")
    .add({
      actor: {
        uid: params.actor.uid,
        email: params.actor.email ?? null,
        role: params.actor.role,
      },
      action: params.action,
      target: params.target,
      reason: params.reason ?? null,
      diff: params.diff ?? null,
      createdAt: new Date(),
    });
}
