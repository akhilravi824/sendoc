"use client";

// Tiptap-based editor for /edit/[editToken].
//
// Replaces the raw <textarea> with a real rich-text editor that's
// forward-compatible with real-time collaboration. The editor is wired
// to a Yjs document so that adding a HocuspocusProvider later is a
// drop-in change — no rewrite of the editor surface itself.
//
// Storage model: sendoc stores markdown in Firestore (because AI
// generates it, the OpenAPI / MCP surfaces expect it, and DocBody
// renders from it). Tiptap edits internally as ProseMirror nodes; we
// use the `tiptap-markdown` extension to serialize back to markdown
// on every change. The persisted Firestore doc remains markdown.
//
// Live collaboration is opt-in via the NEXT_PUBLIC_COLLAB_URL env var.
// When set (e.g. ws://localhost:1234 in dev, wss://collab.sendoc.app in
// prod), the editor connects to that Hocuspocus server using the
// editToken as auth and the docId as the room name. Multiple browsers
// open on the same /edit/[editToken] URL see each other's edits live.
// When unset, the editor falls back to in-memory Yjs (single-user).

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Markdown } from "tiptap-markdown";

interface TiptapEditorProps {
  /** Initial markdown content. Sets the editor on mount; not re-applied. */
  initialMarkdown: string;
  /**
   * Fires on every editor change with the current document serialized
   * back to markdown. Caller debounces and persists to Firestore.
   */
  onChange?: (markdown: string) => void;
  /** Visual placeholder when the doc is empty. */
  placeholder?: string;
  /** Disable editing (e.g. while AI is streaming). */
  readOnly?: boolean;
  /** Forwarded to the editor wrapper for layout. */
  className?: string;
  /**
   * docId — used as the Yjs room name when collab is enabled. Must
   * match what the server stores in the docs collection so its
   * onAuthenticate hook can verify the editToken belongs to this doc.
   */
  docId?: string;
  /** editToken — passed to Hocuspocus as the auth token. */
  editToken?: string;
  /**
   * Display name for the local user's cursor (other peers see this
   * tag floating beside the cursor). Defaults to "Anon".
   */
  userName?: string;
}

// Stable color per session for the live-cursor caret (so peers can tell
// who is who at a glance). Hash a string into one of N preset hues.
const CURSOR_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CURSOR_PALETTE[h % CURSOR_PALETTE.length];
}

export function TiptapEditor({
  initialMarkdown,
  onChange,
  placeholder = "Start writing in Markdown…",
  readOnly = false,
  className = "",
  docId,
  editToken,
  userName = "Anon",
}: TiptapEditorProps) {
  // Yjs doc lives for the lifetime of the editor instance.
  const ydoc = useMemo(() => new Y.Doc(), []);

  // Live-collab provider — only attached when the env var is configured
  // AND we have docId + editToken. Otherwise we run with no provider
  // (single-user, in-memory Yjs only).
  const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL;
  const collabEnabled = Boolean(collabUrl && docId && editToken);

  const provider = useMemo(() => {
    if (!collabEnabled) return null;
    return new HocuspocusProvider({
      url: collabUrl!,
      name: docId!,
      token: editToken!,
      document: ydoc,
      // We seed initial content from markdown once the provider says
      // the doc is empty (first connection ever for this room). After
      // that the server is authoritative.
      onAuthenticationFailed: ({ reason }) => {
        console.warn("[sendoc] collab auth failed:", reason);
      },
    });
    // collabUrl, docId, editToken are derived from props that don't
    // change after the editor mounts; ydoc is stable from useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabEnabled, ydoc]);

  // Track whether we've seeded the Yjs doc with the initial markdown.
  // Collaboration extension expects an empty Y.Doc to start; we feed
  // the initial content via Tiptap's API after mount.
  const seededRef = useRef(false);

  // Local user identity — stable per session, drives live-cursor color.
  const [userId] = useState(
    () =>
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)),
  );
  const userColor = useMemo(() => pickColor(userId), [userId]);

  const editor = useEditor({
    extensions: [
      // StarterKit's history conflicts with Yjs's UndoManager. Disable.
      StarterKit.configure({ history: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false, // strict markdown round-trip (no inline HTML)
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Collaboration.configure({ document: ydoc }),
      // Only enable cursor presence when there's a real provider; without
      // a provider the cursor extension throws on awareness access.
      ...(provider
        ? [
            CollaborationCursor.configure({
              provider,
              user: { name: userName, color: userColor },
            }),
          ]
        : []),
    ],
    editable: !readOnly,
    immediatelyRender: false, // SSR-safe (Next.js App Router)
    editorProps: {
      attributes: {
        class:
          "prose prose-gray prose-headings:font-semibold prose-h1:mb-6 prose-h1:text-3xl prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg max-w-none min-h-[60vh] focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      // tiptap-markdown adds .storage.markdown.getMarkdown()
      const md =
        (
          editor.storage.markdown as { getMarkdown: () => string } | undefined
        )?.getMarkdown() ?? "";
      onChange(md);
    },
  });

  // Seed the Yjs doc with the initial markdown — but only when the
  // doc is genuinely empty. With Hocuspocus, the server may already
  // have content from another peer; we must not clobber it.
  //
  // Strategy:
  //   - No provider (single-user)         → seed immediately
  //   - Provider + sync says empty doc    → seed (we're the first peer)
  //   - Provider + sync delivers content  → leave alone (peer wins)
  useEffect(() => {
    if (!editor || seededRef.current) return;

    const seedIfEmpty = () => {
      if (seededRef.current) return;
      // ProseMirror considers a doc "empty" when it has no content
      // beyond the opening doc node + an empty paragraph.
      const isEmpty = editor.isEmpty;
      if (isEmpty && initialMarkdown) {
        editor.commands.setContent(initialMarkdown, false, {
          preserveWhitespace: "full",
        });
      }
      seededRef.current = true;
    };

    if (!provider) {
      // No live-collab — seed now.
      seedIfEmpty();
      return;
    }

    // With a provider, wait for the first sync before deciding.
    if (provider.isSynced) {
      seedIfEmpty();
    } else {
      provider.on("synced", seedIfEmpty);
      return () => {
        provider.off("synced", seedIfEmpty);
      };
    }
    // We deliberately ignore future changes to initialMarkdown — once
    // the editor is live, the Yjs doc IS the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, provider]);

  // Toggle read-only without remounting (e.g. while AI streams).
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Tear down the provider + Yjs doc on unmount so Hocuspocus closes
  // the connection cleanly and the server can release the room when
  // no peers are left.
  useEffect(() => {
    return () => {
      provider?.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  return (
    <div
      className={`min-h-[60vh] w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30 ${className}`}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Imperative handle for callers that need to programmatically replace
 * the document (e.g. when the user clicks "Apply" on an AI edit). Use
 * sparingly — every replace clobbers Yjs collaborative history.
 */
export function replaceEditorMarkdown(editor: Editor, markdown: string) {
  editor.commands.setContent(markdown, false, { preserveWhitespace: "full" });
}
