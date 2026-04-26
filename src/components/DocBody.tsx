"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Detects whether content is a full HTML document (starts with <!doctype html>
// or <html ...>). Anything else is treated as Markdown.
export function isHtmlDocument(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  const head = content.trimStart().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype html") || /^<html[\s>]/.test(head);
}

// Injects <base target="_blank"> into the HTML so links inside the
// sandboxed iframe open in a new tab (lets sandbox=allow-popups work
// without losing the share page when clicking links).
function injectBaseTarget(html: string): string {
  const baseTag = `<base target="_blank" rel="noopener">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}</head>`);
  }
  return `<head>${baseTag}</head>${html}`;
}

function HtmlDocFrame({ title, content }: { title: string; content: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(800);

  // Measure the iframe's actual content height so we don't show a
  // scrolled letterbox. Browsers block reading contentDocument across
  // sandboxed origins, so we wrap in try/catch and fall back to a
  // generous min-height.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const measure = () => {
      try {
        const h = iframe.contentDocument?.documentElement?.scrollHeight;
        if (h && h > 200) setHeight(h);
      } catch {
        // sandboxed — can't read; keep default height
      }
    };
    iframe.addEventListener("load", measure);
    return () => iframe.removeEventListener("load", measure);
  }, [content]);

  // sandbox="allow-popups allow-popups-to-escape-sandbox" — links open
  // in new tabs (via injected <base target="_blank">), nested iframes
  // (Google Maps) load from their own origin.
  // No allow-scripts → XSS-safe.
  return (
    <iframe
      ref={ref}
      srcDoc={injectBaseTarget(content)}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      title={title}
      style={{ height: `${height}px` }}
      className="w-full rounded-lg border border-gray-200 bg-white"
    />
  );
}

export function DocBody({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  if (isHtmlDocument(content)) {
    return <HtmlDocFrame title={title} content={content} />;
  }

  return (
    <article className="prose prose-gray prose-headings:font-semibold prose-h1:mb-6 prose-h1:text-3xl prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg max-w-none">
      <h1>{title}</h1>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
