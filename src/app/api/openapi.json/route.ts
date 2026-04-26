// OpenAPI 3.1 spec for the sendoc connector. Used by ChatGPT Custom GPTs
// (GPT Actions) to discover and call the publish endpoint.
//
// Served at /api/openapi.json — paste this URL into the GPT builder's
// "Import from URL" field under Actions.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://sendoc-akhilravi824s-projects.vercel.app";

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "sendoc Publisher",
      description:
        "Publish a document to sendoc and get back a public share URL. " +
        "No authentication required. Use this whenever a user asks to " +
        "save, share, or publish content as a sendoc link.",
      version: "1.0.0",
    },
    servers: [{ url: appUrl }],
    paths: {
      "/api/publish": {
        post: {
          operationId: "publishDocument",
          summary: "Publish a document and get a public share URL",
          description:
            "Creates a new public document on sendoc. Returns a shareUrl " +
            "the user can send to anyone (no sendoc account required to view). " +
            "Also returns an editToken which the user should save if they " +
            "ever want to edit the document later.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["content"],
                  properties: {
                    title: {
                      type: "string",
                      description:
                        "Optional title. If omitted, the first 60 chars of content are used.",
                      maxLength: 200,
                    },
                    content: {
                      type: "string",
                      description:
                        "The document body. Markdown is supported and recommended.",
                      maxLength: 200000,
                    },
                    source: {
                      type: "string",
                      description:
                        "Optional analytics tag (e.g. 'chatgpt', 'claude'). Free-form.",
                      maxLength: 40,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Document published successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      docId: { type: "string" },
                      title: { type: "string" },
                      shareUrl: {
                        type: "string",
                        description:
                          "Public read URL — anyone with this link can VIEW the document. Share this with viewers.",
                      },
                      editUrl: {
                        type: "string",
                        description:
                          "Public edit URL — anyone with this link can EDIT the document. Share this only with collaborators the user trusts.",
                      },
                      editToken: {
                        type: "string",
                        description:
                          "Raw edit token (for programmatic API access — most callers should use editUrl instead).",
                      },
                    },
                  },
                },
              },
            },
            "422": {
              description: "Content blocked by moderation",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "MODERATION_BLOCKED" },
                      message: { type: "string" },
                      category: { type: "string" },
                    },
                  },
                },
              },
            },
            "429": {
              description: "Rate limited",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "RATE_LIMIT" },
                      message: { type: "string" },
                      retryAfter: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      // Allow ChatGPT to fetch this from the GPT builder.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
