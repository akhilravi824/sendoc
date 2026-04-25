// Per-UID daily rate limiter using Firestore as the counter store.
// Keeps anonymous abuse from draining your Anthropic budget while letting
// real users (anon or signed-in) use the product.
//
// Anonymous users: 5 generations/day (matches free tier in spec)
// Signed-in users (free): 25 generations/day
// (Pro/Business limits added in Sprint 6 when we have real plans + Stripe.)
//
// Trade-off: Firestore is a per-write cost. At scale (~Phase 2) we move
// this to Redis with INCR/EXPIRE for cheaper, faster counting.

import { Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

const LIMITS = {
  anonymous: 5,
  signedIn: 25,
} as const;

export type RateLimitResult =
  | { ok: true; remaining: number; limit: number }
  | { ok: false; remaining: 0; limit: number; resetAt: Date };

function todayKey(): string {
  // YYYY-MM-DD in UTC, so the bucket flips at midnight UTC for everyone.
  return new Date().toISOString().slice(0, 10);
}

export async function checkAndIncrementRateLimit(
  uid: string,
  isAnonymous: boolean,
): Promise<RateLimitResult> {
  const limit = isAnonymous ? LIMITS.anonymous : LIMITS.signedIn;
  const day = todayKey();
  const ref = adminDb().collection("rateLimits").doc(`${uid}_${day}`);

  // Atomic increment with Firestore transaction.
  return adminDb().runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? snap.data()?.count : 0) || 0;

    if (current >= limit) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      return {
        ok: false as const,
        remaining: 0,
        limit,
        resetAt: tomorrow,
      };
    }

    tx.set(
      ref,
      {
        uid,
        day,
        count: current + 1,
        updatedAt: new Date(),
        // TTL field — set up a Firestore TTL policy on this collection
        // pointing to "expiresAt" to auto-delete old buckets after 7 days.
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      { merge: true },
    );

    return {
      ok: true as const,
      remaining: limit - (current + 1),
      limit,
    };
  });
}
