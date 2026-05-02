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
  | { ok: true; remaining: number; limit: number; resetAt: Date }
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

  // Both branches share a "midnight UTC tomorrow" reset. Compute once.
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  // Atomic increment with Firestore transaction.
  return adminDb().runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? snap.data()?.count : 0) || 0;

    if (current >= limit) {
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
      resetAt: tomorrow,
    };
  });
}

export type IpRateLimitResult = {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number;
};

/**
 * Per-IP rolling-window rate limit. Used for unauthenticated endpoints
 * like /api/reports where there's no UID to key on.
 *
 * Uses Firestore for the counter store. Window is in seconds; the bucket
 * doc auto-expires via the same TTL field as user rate limits.
 */
export async function checkIpRateLimit(
  ip: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<IpRateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const resetAt = new Date(
    (Math.floor(nowSec / windowSeconds) + 1) * windowSeconds * 1000,
  );
  if (!ip || ip === "unknown") {
    // Without an IP we can't enforce — fail open but report headroom.
    return { ok: true, remaining: limit, limit, resetAt };
  }
  const windowKey = Math.floor(Date.now() / (windowSeconds * 1000));
  const ref = adminDb()
    .collection("rateLimits")
    .doc(`ip_${bucket}_${ip}_${windowKey}`);

  return adminDb().runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? snap.data()?.count : 0) || 0;
    if (current >= limit) {
      return {
        ok: false,
        remaining: 0,
        limit,
        resetAt,
        retryAfter: windowSeconds - (nowSec % windowSeconds),
      };
    }
    tx.set(
      ref,
      {
        ip,
        bucket,
        count: current + 1,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + windowSeconds * 2 * 1000),
      },
      { merge: true },
    );
    return {
      ok: true,
      remaining: limit - (current + 1),
      limit,
      resetAt,
    };
  });
}

// Standard rate-limit headers (RFC 6585 inspired, GitHub/Stripe shape).
// Pass to Response constructors so API consumers can self-throttle.
export function rateLimitHeaders(
  rl: { limit: number; remaining: number; resetAt: Date; retryAfter?: number },
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(Math.max(0, rl.remaining)),
    "X-RateLimit-Reset": String(Math.floor(rl.resetAt.getTime() / 1000)),
  };
  if (rl.retryAfter !== undefined) {
    headers["Retry-After"] = String(rl.retryAfter);
  }
  return headers;
}
