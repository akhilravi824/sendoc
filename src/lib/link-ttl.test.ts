import { describe, expect, it } from "vitest";
import { expiryFor, isExpired } from "./link-ttl";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe("link-ttl", () => {
  const recent = new Date("2026-05-01T12:00:00Z");

  it("owned docs never expire", () => {
    expect(
      expiryFor({ ownerId: "user_123", createdAt: recent }),
    ).toBeNull();
    expect(
      isExpired({ ownerId: "user_123", createdAt: new Date(0) }),
    ).toBe(false);
  });

  it("anonymous docs expire 7 days after creation", () => {
    const exp = expiryFor({ ownerId: null, createdAt: recent });
    expect(exp).toBe(recent.getTime() + SEVEN_DAYS_MS);
  });

  it("anonymous doc not yet expired", () => {
    const now = recent.getTime() + SEVEN_DAYS_MS - 60_000;
    expect(isExpired({ ownerId: null, createdAt: recent }, now)).toBe(false);
  });

  it("anonymous doc just past 7 days is expired", () => {
    const now = recent.getTime() + SEVEN_DAYS_MS + 60_000;
    expect(isExpired({ ownerId: null, createdAt: recent }, now)).toBe(true);
  });

  it("explicit shareLink.ttl overrides default 7 days", () => {
    const customExpiry = recent.getTime() + 60_000;
    expect(
      expiryFor({
        ownerId: null,
        createdAt: recent,
        shareLink: { ttl: customExpiry },
      }),
    ).toBe(customExpiry);
    expect(
      isExpired(
        {
          ownerId: null,
          createdAt: recent,
          shareLink: { ttl: customExpiry },
        },
        recent.getTime() + 120_000,
      ),
    ).toBe(true);
  });

  it("missing createdAt yields null expiry (fail-safe: don't auto-expire)", () => {
    expect(expiryFor({ ownerId: null, createdAt: null })).toBeNull();
    expect(isExpired({ ownerId: null, createdAt: null })).toBe(false);
  });

  it("supports both Date and Firestore Timestamp-like values", () => {
    const fakeTimestamp = { toMillis: () => recent.getTime() };
    const exp = expiryFor({
      ownerId: null,
      createdAt: fakeTimestamp as unknown as Date,
    });
    expect(exp).toBe(recent.getTime() + SEVEN_DAYS_MS);
  });
});
