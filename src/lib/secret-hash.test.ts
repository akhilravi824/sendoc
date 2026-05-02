import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { legacyHash, lookupHashes, pepperedHash } from "./secret-hash";

describe("secret-hash", () => {
  const originalPepper = process.env.API_KEY_PEPPER;

  beforeEach(() => {
    process.env.API_KEY_PEPPER =
      "test-pepper-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  });

  afterEach(() => {
    if (originalPepper === undefined) delete process.env.API_KEY_PEPPER;
    else process.env.API_KEY_PEPPER = originalPepper;
  });

  it("pepperedHash is stable for the same input + pepper", () => {
    expect(pepperedHash("hello")).toBe(pepperedHash("hello"));
  });

  it("pepperedHash differs for different inputs", () => {
    expect(pepperedHash("hello")).not.toBe(pepperedHash("world"));
  });

  it("pepperedHash differs from legacyHash for the same input", () => {
    expect(pepperedHash("hello")).not.toBe(legacyHash("hello"));
  });

  it("changing the pepper changes the hash", () => {
    const a = pepperedHash("hello");
    process.env.API_KEY_PEPPER = "different-pepper-bbbbbbbbbbbbbbbbbbbbb";
    const b = pepperedHash("hello");
    expect(a).not.toBe(b);
  });

  it("legacyHash matches a known SHA-256 fixture", () => {
    // sha256("sendoc") computed independently
    expect(legacyHash("sendoc")).toBe(
      "e8300c85fafedca25f60763b2839007def90a63d6dc01d5b8e6fd7116640fb59",
    );
  });

  it("lookupHashes returns [peppered, legacy] in that order", () => {
    const [a, b] = lookupHashes("hello");
    expect(a).toBe(pepperedHash("hello"));
    expect(b).toBe(legacyHash("hello"));
  });
});
