import { describe, expect, it } from "vitest";
import { isHtmlDocument } from "./DocBody";

describe("isHtmlDocument", () => {
  it("recognizes <!doctype html>", () => {
    expect(isHtmlDocument("<!doctype html><html>...")).toBe(true);
    expect(isHtmlDocument("<!DOCTYPE HTML PUBLIC ...")).toBe(true);
  });

  it("recognizes a leading <html> tag", () => {
    expect(isHtmlDocument("<html><body>x</body></html>")).toBe(true);
    expect(isHtmlDocument("<html lang='en'>")).toBe(true);
  });

  it("ignores leading whitespace", () => {
    expect(isHtmlDocument("\n   <!doctype html>\n<html>")).toBe(true);
  });

  it("treats markdown as not-HTML", () => {
    expect(isHtmlDocument("# Hello\n\nMarkdown body")).toBe(false);
    expect(isHtmlDocument("Just some plain text")).toBe(false);
  });

  it("rejects HTML fragments without a doctype/html root", () => {
    // We render fragments through ReactMarkdown, which is fine since
    // our intent here is "is this a *full* document?"
    expect(isHtmlDocument("<div>hi</div>")).toBe(false);
    expect(isHtmlDocument("<p>hello</p>")).toBe(false);
  });

  it("handles empty/null safely", () => {
    expect(isHtmlDocument("")).toBe(false);
    expect(isHtmlDocument(null as unknown as string)).toBe(false);
    expect(isHtmlDocument(undefined as unknown as string)).toBe(false);
  });
});
