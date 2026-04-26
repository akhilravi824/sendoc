// API key system for the connector backend.
//
// Used by external clients (Claude MCP, ChatGPT GPT Action, scripts) to
// authenticate as a sendoc user without going through Firebase Auth.
//
// Format: `sk_sendoc_<32 random base32 chars>`
// Storage: SHA-256 hash of the token, alongside metadata. The plaintext
// is shown to the user ONCE on creation; we never store it.

import crypto from "node:crypto";

const KEY_PREFIX = "sk_sendoc_";

export function generateApiKey(): { token: string; prefix: string; hash: string } {
  // 32 base32-style chars = 160 bits of entropy. Plenty.
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let body = "";
  for (let i = 0; i < 32; i++) {
    body += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  const token = `${KEY_PREFIX}${body}`;
  return {
    token,
    prefix: token.slice(0, KEY_PREFIX.length + 6), // shown in UI (e.g. sk_sendoc_abc123)
    hash: hashToken(token),
  };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isApiKey(token: string): boolean {
  return token.startsWith(KEY_PREFIX);
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim() || null;
}
