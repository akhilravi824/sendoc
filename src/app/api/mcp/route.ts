// MCP (Model Context Protocol) server for sendoc.
//
// Exposes a single tool — `publish_to_sendoc` — that lets Claude (or any
// MCP-compatible client) publish content to sendoc and get back a public
// share URL. No auth required.
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
const SERVER_VERSION = "1.0.0";

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
] as const;

async function callPublish(
  args: { title?: string; content: string },
  origin: string,
): Promise<unknown> {
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
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Publish failed: ${json.message ?? json.error ?? "unknown error"}`,
        },
      ],
    };
  }
  return {
    content: [
      {
        type: "text",
        text:
          `✓ Published to sendoc.\n\n` +
          `📖 Public read URL (share this with viewers):\n${json.shareUrl}\n\n` +
          `✏️ Edit URL (share only with collaborators you trust — anyone with this URL can edit):\n${json.editUrl}`,
      },
    ],
  };
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
        arguments?: { title?: string; content?: string };
      };
      if (params.name !== "publish_to_sendoc") {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${params.name}` },
        };
      }
      const args = params.arguments ?? {};
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
