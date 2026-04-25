import { adminAuth, adminDb } from "@/lib/firebase-admin";

export type Role = "user" | "moderator" | "admin" | "super_admin";

export const PRIVILEGED_ROLES: Role[] = ["moderator", "admin", "super_admin"];

export function isPrivileged(role: Role | null | undefined): boolean {
  return !!role && PRIVILEGED_ROLES.includes(role);
}

export function canTakedown(role: Role | null | undefined): boolean {
  return role === "moderator" || role === "admin" || role === "super_admin";
}

export function canGrantRoles(role: Role | null | undefined): boolean {
  return role === "super_admin";
}

/**
 * Sets a role on a user — writes both:
 *   1. Firebase custom claim (sealed in JWT, fast checks in API + rules)
 *   2. Firestore users/{uid} mirror (queryable for admin UIs)
 *
 * Only call this from server-side code that has already authorized the
 * caller (the API route or the bootstrap script).
 */
export async function setRole(
  uid: string,
  role: Role,
  meta: { email?: string | null; displayName?: string | null } = {},
) {
  await adminAuth().setCustomUserClaims(uid, { role });
  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        role,
        email: meta.email ?? null,
        displayName: meta.displayName ?? null,
        updatedAt: new Date(),
      },
      { merge: true },
    );
}
