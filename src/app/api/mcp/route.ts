// MCP (Model Context Protocol) server for sendoc.
//
// Exposes three tools that let Claude (or any MCP-compatible client)
// work with sendoc docs:
//   - publish_to_sendoc — create a new public doc
//   - read_sendoc_doc   — fetch a doc by edit token
//   - edit_sendoc_doc   — replace a doc's title/content using edit token
//
// All operations are token-gated; no separate auth required beyond the
// edit token returned at publish time.
//
// Transport: Streamable HTTP (JSON-RPC 2.0 over POST).
// Claude.ai users add this URL as a "Custom Connector" in Settings.
//
// Usage in Claude.ai:
//   Settings → Connectors → Add custom server
//   URL: https://sendoc-akhilravi824s-projects.vercel.app/api/mcp
//
// Usage in Claude Desktop:
//   Use mcp-remote bridge OR add to claude_desktop_config.json with a
//   stdio-to-HTTP proxy.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "sendoc";
const SERVER_VERSION = "1.1.0";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const TOOLS = [
  {
    name: "publish_to_sendoc",
    description:
      "Publish a document to sendoc and get back a public share URL. " +
      "Use this whenever the user asks to publish, share, or save content " +
      "as a public link. Returns a shareUrl that anyone can open in a browser " +
      "(no sendoc account required to view) plus an editToken the user should " +
      "save if they want to edit the document later.",
    inputSchema: {
      type: "object",
      required: ["content"],
      properties: {
        title: {
          type: "string",
          description:
            "Optional short title (max 200 chars). Falls back to first 60 chars of content.",
        },
        content: {
          type: "string",
          description:
            "Document body. Use clean Markdown — # for title, ## for sections, lists where they help.",
        },
      },
    },
  },
  {
    name: "read_sendoc_doc",
    description:
      "Read the current title and content of a sendoc doc by edit token. " +
      "Use this before edit_sendoc_doc when the user wants to iterate on a " +
      "previously-published doc and you don't already have its content.",
    inputSchema: {
      type: "object",
      required: ["editToken"],
      properties: {
        editToken: {
          type: "string",
          description:
            "The edit token returned by publish_to_sendoc (or the trailing path of the editUrl).",
        },
      },
    },
  },
  {
    name: "edit_sendoc_doc",
    description:
      "Replace the title and/or content of an existing sendoc doc. Pass " +
      "the editToken returned at publish time. Use this whenever the user " +
      "wants to update, rewrite, append to, or otherwise modify a doc " +
      "they've already published.",
    inputSchema: {
      type: "object",
      required: ["editToken"],
      properties: {
        editToken: {
          type: "string",
          description: "Edit token for the doc to update.",
        },
        title: { type: "string", description: "New title (optional)." },
        content: {
          type: "string",
          description:
            "Full new document body (Markdown). Send the COMPLETE new doc; the server overwrites previous content.",
        },
      },
    },
  },
] as const;

type McpResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};

function errorResult(message: string): McpResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function textResult(text: string): McpResult {
  return { content: [{ type: "text", text }] };
}

// Some clients pass the full editUrl instead of just the token. Strip
// the URL prefix if present so we accept both.
function normalizeEditToken(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/edit\/([^/?#]+)/);
  return m ? m[1] : trimmed;
}

async function callPublish(
  args: { title?: string; content: string },
  origin: string,
): Promise<McpResult> {
  const res = await fetch(`${origin}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: args.title,
      content: args.content,
      source: "claude-mcp",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    return errorResult(
      `Publish failed: ${json.message ?? json.error ?? "unknown error"}`,
    );
  }
  return textResult(
    `✓ Published to sendoc.\n\n` +
      `📖 Public read URL (share this with viewers):\n${json.shareUrl}\n\n` +
      `✏️ Edit URL (share only with collaborators you trust — anyone with this URL can edit):\n${json.editUrl}\n\n` +
      `editToken: ${json.editToken}`,
  );
}

async function callRead(editToken: string, origin: string): Promise<McpResult> {
  const res = await fetch(
    `${origin}/api/edit/${encodeURIComponent(editToken)}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return errorResult(
      res.status === 410
        ? "This doc has expired. Anonymous docs are removed after 7 days unless claimed."
        : `Read failed: ${json.message ?? json.error ?? `HTTP ${res.status}`}`,
    );
  }
  return textResult(
    `# ${json.title || "Untitled"}\n\n${json.content || ""}\n\n` +
      `(shareUrl: ${json.shareUrl})`,
  );
}

async function callEdit(
  args: { editToken: string; title?: string; content?: string },
  origin: string,
): Promise<McpResult> {
  if (args.title === undefined && args.content === undefined) {
    return errorResult("Pass at least one of `title` or `content` to update.");
  }
  const res = await fetch(
    `${origin}/api/edit/${encodeURIComponent(args.editToken)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.content !== undefined ? { content: args.content } : {}),
      }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return errorResult(
      res.status === 410
        ? "This doc has expired and can't be edited."
        : `Edit failed: ${json.message ?? json.error ?? `HTTP ${res.status}`}`,
    );
  }
  return textResult("✓ Doc updated.");
}

function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "";
  return process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
}

async function handleRpc(
  rpc: JsonRpcRequest,
  origin: string,
): Promise<JsonRpcResponse> {
  const id = rpc.id ?? null;

  switch (rpc.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        },
      };

    case "notifications/initialized":
      // Notification — no response expected.
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      };

    case "tools/call": {
      const params = (rpc.params ?? {}) as {
        name?: string;
        arguments?: {
          title?: string;
          content?: string;
          editToken?: string;
        };
      };
      const args = params.arguments ?? {};

      if (params.name === "publish_to_sendoc") {
        if (!args.content || typeof args.content !== "string") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "`content` argument is required" },
          };
        }
        const result = await callPublish(
          { title: args.title, content: args.content },
          origin,
        );
        return { jsonrpc: "2.0", id, result };
      }

      if (params.name === "read_sendoc_doc") {
        if (!args.editToken || typeof args.editToken !== "string") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "`editToken` argument is required" },
          };
        }
        const result = await callRead(
          normalizeEditToken(args.editToken),
          origin,
        );
        return { jsonrpc: "2.0", id, result };
      }

      if (params.name === "edit_sendoc_doc") {
        if (!args.editToken || typeof args.editToken !== "string") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "`editToken` argument is required" },
          };
        }
        const result = await callEdit(
          {
            editToken: normalizeEditToken(args.editToken),
            title: args.title,
            content: args.content,
          },
          origin,
        );
        return { jsonrpc: "2.0", id, result };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${params.name}` },
      };
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${rpc.method}` },
      };
  }
}

export async function POST(req: NextRequest) {
  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  const origin = getOrigin(req);

  // JSON-RPC supports batch requests (an array). Handle both.
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((rpc) => handleRpc(rpc, origin)),
    );
    return NextResponse.json(responses);
  }

  const response = await handleRpc(body, origin);
  return NextResponse.json(response);
}

// MCP also requires a GET handler for SSE-style streaming. We return
// 405 since this implementation uses request/response only — clients
// fall back to POST for everything.
export async function GET() {
  return NextResponse.json(
    { error: "This MCP server uses POST-only transport." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

// CORS preflight for cross-origin clients (Claude.ai is on a different
// domain from your sendoc deployment).
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
