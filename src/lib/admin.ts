import { verifyIdToken } from "@/lib/firebase-admin";
import type { Role } from "./auth/claims";

/**
 * Verifies the request's ID token and confirms the caller's role
 * (custom claim) is in `allowed`. Throws "FORBIDDEN" otherwise.
 *
 * Returns the decoded token enriched with a typed role.
 */
export async function requireRole(
  authorizationHeader: string | null,
  allowed: Role[],
) {
  const decoded = await verifyIdToken(authorizationHeader);
  const role = (decoded.role as Role | undefined) ?? "user";
  if (!allowed.includes(role)) {
    throw new Error("FORBIDDEN");
  }
  return { ...decoded, role };
}
