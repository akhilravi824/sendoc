"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Detects whether content is a full HTML document (starts with <!doctype html>
// or <html ...>). Anything else is treated as Markdown.
//
// We render full HTML docs inside a sandboxed iframe via srcdoc so the
// document's <style>, <body>, <iframe> etc. all work as the author
// intended without leaking styles into sendoc's chrome — and without
// letting the document's <script> run in our origin.
export function isHtmlDocument(content: string): boolean {
  if (!content) return false;
  const head = content.trimStart().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype html") || /^<html[\s>]/.test(head);
}

export function DocBody({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  if (isHtmlDocument(content)) {
    // sandbox="allow-popups" — links can open new tabs; nested iframes
    // (e.g., Google Maps embeds) load from their own origin so they're
    // unaffected by our sandbox.
    // Intentionally NOT including "allow-scripts" or "allow-same-origin"
    // — that's the XSS protection.
    return (
      <iframe
        srcDoc={content}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        title={title}
        className="min-h-[80vh] w-full rounded-lg border border-gray-200 bg-white"
      />
    );
  }

  return (
    <article className="prose prose-gray prose-headings:font-semibold prose-h1:mb-6 prose-h1:text-3xl prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg max-w-none">
      <h1>{title}</h1>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
