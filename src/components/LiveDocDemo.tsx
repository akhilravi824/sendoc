"use client";

// LiveDocDemo — animated, looping editor that shows three peers
// (Claude, GPT-4, You) collaborating on the same document in real time.
//
// Pure React + CSS, no animation library. Each peer has a scripted
// timeline of "ops" (typing or pausing) and a position computed from
// where they're currently writing in the doc. Cursors move with a
// CSS transition; characters append on a tick.
//
// This is the marketing surface that tells the whole product story
// in 30 seconds — by far the most important component on the site.
// The code that ships is intentionally minimal so it stays fast and
// fits on a hero section without dominating the bundle.

import { useEffect, useMemo, useRef, useState } from "react";

type PeerKey = "claude" | "gpt" | "you";

interface Peer {
  key: PeerKey;
  name: string;
  color: string;
  /** Color used for the dim translucent caret tail. */
  tint: string;
}

interface Op {
  peer: PeerKey;
  /** Character to type. Use "\n" for newline. Use null for a pause. */
  char: string | null;
  /** Delay BEFORE this op fires, in ms. */
  delay?: number;
}

const PEERS: Record<PeerKey, Peer> = {
  claude: {
    key: "claude",
    name: "Claude",
    color: "#f97316", // orange — Anthropic-ish
    tint: "rgba(249, 115, 22, 0.18)",
  },
  gpt: {
    key: "gpt",
    name: "GPT-4",
    color: "#10b981", // emerald — OpenAI green
    tint: "rgba(16, 185, 129, 0.18)",
  },
  you: {
    key: "you",
    name: "You",
    color: "#a855f7", // purple
    tint: "rgba(168, 85, 247, 0.22)",
  },
};

// Pre-scripted "session" — claude opens the doc with the title and the
// morning section, you add an afternoon header, gpt fills in evening.
// The pacing is tuned for visual rhythm: short bursts + breathing room.
function buildScript(): Op[] {
  const ops: Op[] = [];

  const type = (peer: PeerKey, text: string, charDelay = 28) => {
    for (const ch of text) {
      ops.push({ peer, char: ch, delay: charDelay });
    }
  };
  const pause = (ms: number) => {
    ops.push({ peer: "claude", char: null, delay: ms });
  };

  type("claude", "# Atlanta — One Day\n\n", 22);
  pause(220);
  type("claude", "## ☕ Morning\n\nGrab coffee at ", 24);
  type("claude", "Octane", 30);
  type("claude", " on Marietta. ");
  pause(160);
  type("claude", "Walk the BeltLine.", 28);
  pause(380);

  // You jump in
  type("you", "\n\n## 🌇 Afternoon\n", 32);
  pause(240);
  type("you", "Ponce City Market — ", 30);
  type("you", "lunch + the rooftop.", 26);
  pause(420);

  // GPT-4 finishes the evening
  type("gpt", "\n\n## 🍽️ Evening\n", 28);
  pause(180);
  type("gpt", "Reservation at ", 26);
  type("gpt", "Staplehouse", 32);
  type("gpt", ". ", 26);
  type("gpt", "Drinks after at ", 26);
  type("gpt", "Kimball House.", 28);

  pause(1800); // hold the finished doc on screen before looping
  return ops;
}

interface DocState {
  /** The current rendered text. */
  text: string;
  /** Per-peer cursor offset into `text` (where they last wrote). */
  cursorAt: Record<PeerKey, number>;
  /** Which peer is currently typing (drives the active glow). */
  activePeer: PeerKey | null;
}

const initialState: DocState = {
  text: "",
  cursorAt: { claude: 0, gpt: 0, you: 0 },
  activePeer: null,
};

export function LiveDocDemo() {
  const script = useMemo(() => buildScript(), []);
  const [state, setState] = useState<DocState>(initialState);
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      const op = script[stepRef.current];
      if (!op) {
        // Loop after a brief pause so the demo feels alive forever.
        stepRef.current = 0;
        timerRef.current = setTimeout(() => {
          setState(initialState);
          tick();
        }, 1200);
        return;
      }
      stepRef.current += 1;

      timerRef.current = setTimeout(() => {
        if (op.char === null) {
          // Pause op — just advance, keep the active peer for visual continuity
          setState((s) => ({ ...s, activePeer: op.peer }));
        } else {
          setState((s) => {
            // The typing peer's cursor sits at the end of what they typed;
            // other peers' cursors advance forward to stay just ahead of
            // the new content (so they don't appear to fall behind).
            const newText = s.text + op.char;
            const newLen = newText.length;
            const cursorAt: Record<PeerKey, number> = { ...s.cursorAt };
            cursorAt[op.peer] = newLen;
            // Other peers stay where they last wrote, but never lag the
            // doc end by more than 60 chars (keeps cursors visible on
            // screen as the doc grows).
            (Object.keys(cursorAt) as PeerKey[]).forEach((p) => {
              if (p !== op.peer && newLen - cursorAt[p] > 60) {
                cursorAt[p] = Math.max(0, newLen - 30);
              }
            });
            return { text: newText, cursorAt, activePeer: op.peer };
          });
        }
        tick();
      }, op.delay ?? 30);
    }

    tick();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gray-950 shadow-[0_30px_120px_-24px_rgba(168,85,247,0.45)]">
      {/* Faux toolbar */}
      <div className="flex items-center justify-between border-b border-white/5 bg-gray-900/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 text-xs font-medium text-gray-400">
            sendoc.app/edit/atlanta-itinerary
          </span>
        </div>
        <PeerStack activePeer={state.activePeer} />
      </div>

      {/* Body */}
      <div className="relative px-6 py-7 sm:px-9 sm:py-9">
        <DocBody text={state.text} cursorAt={state.cursorAt} />
        {/* Soft animated gradient at bottom for liveliness */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gray-950 to-transparent" />
      </div>
    </div>
  );
}

function PeerStack({ activePeer }: { activePeer: PeerKey | null }) {
  return (
    <div className="flex -space-x-1.5">
      {(Object.keys(PEERS) as PeerKey[]).map((k) => {
        const peer = PEERS[k];
        const active = activePeer === k;
        return (
          <span
            key={k}
            className="grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-bold transition-all"
            style={{
              backgroundColor: peer.color,
              borderColor: active ? "#fff" : "rgba(31,41,55,1)",
              color: "white",
              boxShadow: active
                ? `0 0 0 2px ${peer.color}, 0 0 16px ${peer.color}`
                : "none",
            }}
            title={peer.name}
          >
            {peer.name[0]}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Renders the doc text with each peer's cursor inline at their offset.
 * The cursor for the *active* peer also pulses; others sit quietly.
 *
 * We render the text into chunks separated by cursor markers so the
 * caret carets can't get visually mangled by line wrapping.
 */
function DocBody({
  text,
  cursorAt,
}: {
  text: string;
  cursorAt: Record<PeerKey, number>;
}) {
  // Split text at every cursor offset, in ascending order. We deduplicate
  // offsets so two peers at the same position both get a caret without
  // splitting the string twice.
  const offsets = (Object.keys(cursorAt) as PeerKey[])
    .map((p) => ({ p, at: Math.min(cursorAt[p], text.length) }))
    .sort((a, b) => a.at - b.at);

  const segments: Array<{
    type: "text" | "caret";
    payload: string | { peer: PeerKey };
    key: string;
  }> = [];
  let prev = 0;
  offsets.forEach(({ p, at }, i) => {
    if (at > prev) {
      segments.push({
        type: "text",
        payload: text.slice(prev, at),
        key: `t-${i}-${prev}-${at}`,
      });
      prev = at;
    }
    segments.push({
      type: "caret",
      payload: { peer: p },
      key: `c-${p}-${at}`,
    });
  });
  if (prev < text.length) {
    segments.push({
      type: "text",
      payload: text.slice(prev),
      key: `tail-${prev}`,
    });
  }

  return (
    <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[13.5px] leading-[1.7] text-gray-100">
      {segments.map((s) => {
        if (s.type === "text") {
          return <span key={s.key}>{renderMarkdownish(s.payload as string)}</span>;
        }
        const { peer } = s.payload as { peer: PeerKey };
        return <PeerCaret key={s.key} peer={PEERS[peer]} />;
      })}
    </pre>
  );
}

/**
 * Tiny visual flourish: bold the markdown headings so the demo doesn't
 * look like a plain wall of `#` characters. We don't render HTML — just
 * span-wrap heading lines with brighter color.
 */
function renderMarkdownish(text: string): React.ReactNode {
  const parts = text.split("\n");
  return parts.map((line, i) => {
    const isLast = i === parts.length - 1;
    let node: React.ReactNode = line;
    if (line.startsWith("# ")) {
      node = (
        <span className="font-semibold text-white">{line}</span>
      );
    } else if (line.startsWith("## ")) {
      node = <span className="font-semibold text-purple-200">{line}</span>;
    }
    return (
      <span key={i}>
        {node}
        {!isLast ? "\n" : ""}
      </span>
    );
  });
}

function PeerCaret({ peer }: { peer: Peer }) {
  return (
    <span
      className="relative inline-block"
      style={{ color: peer.color }}
      aria-hidden
    >
      <span
        className="inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse"
        style={{ backgroundColor: peer.color }}
      />
      <span
        className="absolute -top-5 left-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
        style={{ backgroundColor: peer.color }}
      >
        {peer.name}
      </span>
    </span>
  );
}
