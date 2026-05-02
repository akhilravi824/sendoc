// Link TTL enforcement for anonymous (unowned) docs.
//
// Owned docs (ownerId set) live forever. Unowned docs expire 7 days
// after creation — long enough for the original publisher to grab the
// edit URL and claim, short enough to keep the public share surface
// from being a dumping ground.
//
// Enforced at read time on /api/share/[token], /api/share/[token]/copy,
// and /api/edit/[editToken]. Storage keeps the doc (so admin audits
// still resolve), but every public surface returns 410 GONE.

import type { Timestamp } from "firebase-admin/firestore";

const ANONYMOUS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DocLike = {
  ownerId?: string | null;
  createdAt?: Timestamp | Date | null;
  shareLink?: { ttl?: number | null } | null;
};

function toMillis(ts: Timestamp | Date | null | undefined): number | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts.getTime();
  if (typeof (ts as Timestamp).toMillis === "function") {
    return (ts as Timestamp).toMillis();
  }
  return null;
}

export function expiryFor(doc: DocLike): number | null {
  if (doc.ownerId) return null; // owned docs never expire
  // Per-doc override: shareLink.ttl is an explicit unix-ms expiry. If
  // present, trust it (admins set it for early take-down with grace).
  if (doc.shareLink?.ttl) {
    return Number(doc.shareLink.ttl);
  }
  const created = toMillis(doc.createdAt ?? null);
  if (!created) return null;
  return created + ANONYMOUS_TTL_MS;
}

export function isExpired(doc: DocLike, now = Date.now()): boolean {
  const exp = expiryFor(doc);
  return exp !== null && now >= exp;
}
