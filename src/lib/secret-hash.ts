// Peppered hashing for API keys and edit tokens.
//
// Why not plain SHA-256? Because if the Firestore data ever leaked, an
// attacker could try matching brute-forced tokens against the stored
// hashes offline. Adding a server-side pepper (kept in env vars / secret
// manager — *not* the database) means a DB leak alone is insufficient
// to validate keys offline. This is the API-key best-practice that
// partner programs (OpenAI Apps, Anthropic MCP Partner) look for.
//
// Migration: legacy values were SHA-256(token). New values are
// HMAC-SHA-256(pepper, token). Lookups query for both; on hit we
// opportunistically rotate the legacy record to the new hash.
//
// When `API_KEY_PEPPER` is not set in the environment we fall back to a
// hardcoded sentinel so the app still boots locally. Ops should set the
// real pepper via Vercel env vars (or Google Secret Manager) before
// going to prod.

import crypto from "node:crypto";

const FALLBACK_PEPPER =
  "sendoc-dev-pepper-do-not-use-in-prod-c8f1e9a7b3d2e6f4";

function getPepper(): string {
  return process.env.API_KEY_PEPPER || FALLBACK_PEPPER;
}

export function pepperedHash(token: string): string {
  return crypto.createHmac("sha256", getPepper()).update(token).digest("hex");
}

export function legacyHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Returns [newHash, legacyHash] — pass to a Firestore `in` query so a
// single round-trip handles both formats.
export function lookupHashes(token: string): [string, string] {
  return [pepperedHash(token), legacyHash(token)];
}
