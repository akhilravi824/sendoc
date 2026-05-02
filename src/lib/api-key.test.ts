import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractBearerToken,
  generateApiKey,
  hashToken,
  isApiKey,
} from "./api-key";

describe("api-key", () => {
  const originalPepper = process.env.API_KEY_PEPPER;
  beforeEach(() => {
    process.env.API_KEY_PEPPER = "fixed-test-pepper-cccccccccccccccccccccc";
  });
  afterEach(() => {
    if (originalPepper === undefined) delete process.env.API_KEY_PEPPER;
    else process.env.API_KEY_PEPPER = originalPepper;
  });

  describe("generateApiKey", () => {
    it("returns a sk_sendoc_ prefixed token", () => {
      const k = generateApiKey();
      expect(k.token.startsWith("sk_sendoc_")).toBe(true);
    });

    it("token body is 32 base32-style chars after the prefix", () => {
      const k = generateApiKey();
      const body = k.token.slice("sk_sendoc_".length);
      expect(body).toMatch(/^[a-z2-7]{32}$/);
    });

    it("prefix is the first 16 chars of the token (sk_sendoc_ + 6)", () => {
      const k = generateApiKey();
      expect(k.prefix.length).toBe("sk_sendoc_".length + 6);
      expect(k.token.startsWith(k.prefix)).toBe(true);
    });

    it("hash matches hashToken(token)", () => {
      const k = generateApiKey();
      expect(k.hash).toBe(hashToken(k.token));
    });

    it("two generations produce different tokens (entropy sanity check)", () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a.token).not.toBe(b.token);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe("isApiKey", () => {
    it("recognizes the sk_sendoc_ prefix", () => {
      expect(isApiKey("sk_sendoc_abcdef")).toBe(true);
    });

    it("rejects Firebase ID tokens and arbitrary strings", () => {
      expect(isApiKey("eyJhbGciOiJSUzI1NiIs")).toBe(false);
      expect(isApiKey("")).toBe(false);
      expect(isApiKey("Bearer sk_sendoc_x")).toBe(false);
    });
  });

  describe("extractBearerToken", () => {
    it("strips 'Bearer ' prefix and trims", () => {
      expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
      expect(extractBearerToken("Bearer  spaced  ")).toBe("spaced");
    });

    it("returns null for missing or malformed headers", () => {
      expect(extractBearerToken(null)).toBeNull();
      expect(extractBearerToken("")).toBeNull();
      expect(extractBearerToken("Token abc")).toBeNull();
      expect(extractBearerToken("Bearer ")).toBeNull();
    });
  });
});
