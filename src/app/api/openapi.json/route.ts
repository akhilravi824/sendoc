// OpenAPI 3.1 spec for the sendoc connector. Used by ChatGPT Custom GPTs
// (GPT Actions) to discover and call the sendoc endpoints.
//
// Served at /api/openapi.json — paste this URL into the GPT builder's
// "Import from URL" field under Actions.
//
// We expose four operations:
//   publishDocument  — create a new public doc (no auth)
//   getEditableDoc   — read the current state of a doc by edit token
//   updateDocument   — patch title / content (token auth implicit in path)
//   askAiToEdit      — ask sendoc's Claude to rewrite the doc per an instruction

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
        "Publish, read, and edit sendoc documents. No authentication is " +
        "required for publishDocument; getEditableDoc / updateDocument / " +
        "askAiToEdit gate on the editToken returned at publish time.",
      version: "1.1.0",
    },
    servers: [{ url: appUrl }],
    paths: {
      "/api/publish": {
        post: {
          operationId: "publishDocument",
          summary: "Publish a document and get a public share URL",
          description:
            "Creates a new public document on sendoc. Returns a shareUrl " +
            "the user can send to anyone (no sendoc account required to view), " +
            "an editUrl for collaborators, and an editToken (save this if you " +
            "want to call updateDocument later). Anonymous docs expire 7 days " +
            "after creation unless claimed by a sendoc account.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublishRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Document published successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PublishResponse" },
                },
              },
            },
            "422": { $ref: "#/components/responses/ModerationBlocked" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/api/edit/{editToken}": {
        get: {
          operationId: "getEditableDoc",
          summary: "Read the current state of a doc you hold the edit token for",
          description:
            "Returns the title, content, share URL, and metadata of the " +
            "document. 410 GONE is returned when the link has expired " +
            "(7 days after creation for anonymous docs).",
          parameters: [
            {
              name: "editToken",
              in: "path",
              required: true,
              description:
                "The plaintext edit token returned by publishDocument.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Doc retrieved",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EditableDoc" },
                },
              },
            },
            "404": { description: "No doc matches this edit token" },
            "410": { $ref: "#/components/responses/Expired" },
          },
        },
        patch: {
          operationId: "updateDocument",
          summary: "Update the title and/or content of an existing doc",
          description:
            "Patches the doc behind this edit token. Pass the fields you " +
            "want to change. Edits are re-moderated; flagged content is " +
            "rejected with 422.",
          parameters: [
            {
              name: "editToken",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Update applied" },
            "404": { description: "No doc matches this edit token" },
            "410": { $ref: "#/components/responses/Expired" },
            "422": { $ref: "#/components/responses/ModerationBlocked" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
        delete: {
          operationId: "deleteDocument",
          summary: "Delete a doc you own (soft delete; admins can restore)",
          parameters: [
            {
              name: "editToken",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Deleted" },
            "404": { description: "No doc matches this edit token" },
          },
        },
      },
      "/api/edit/{editToken}/ai": {
        post: {
          operationId: "askAiToEdit",
          summary: "Ask sendoc's AI to rewrite the doc per an instruction",
          description:
            "Streams the proposed updated document back as plain text. " +
            "Apply by calling updateDocument with the returned content. " +
            "Per-IP limit: 10/hour. Per-doc limit: 30/day.",
          parameters: [
            {
              name: "editToken",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["instruction"],
                  properties: {
                    instruction: {
                      type: "string",
                      maxLength: 2000,
                      description:
                        "Plain-language instruction (e.g. 'add a hotel section', 'translate to Spanish').",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description:
                "Streaming text/plain response containing the proposed updated doc",
              content: { "text/plain": { schema: { type: "string" } } },
            },
            "404": { description: "No doc matches this edit token" },
            "410": { $ref: "#/components/responses/Expired" },
            "422": { $ref: "#/components/responses/ModerationBlocked" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
    },
    components: {
      schemas: {
        PublishRequest: {
          type: "object",
          required: ["content"],
          properties: {
            title: { type: "string", maxLength: 200 },
            content: { type: "string", maxLength: 200000 },
            source: { type: "string", maxLength: 40 },
          },
        },
        PublishResponse: {
          type: "object",
          properties: {
            docId: { type: "string" },
            title: { type: "string" },
            shareUrl: { type: "string" },
            editUrl: { type: "string" },
            editToken: { type: "string" },
          },
        },
        EditableDoc: {
          type: "object",
          properties: {
            docId: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            shareUrl: { type: "string" },
            updatedAt: { type: ["integer", "null"] },
            ownerId: { type: ["string", "null"] },
            ownerEmail: { type: ["string", "null"] },
            expiresAt: {
              type: ["integer", "null"],
              description:
                "Unix-ms expiry for anonymous docs; null for owned docs.",
            },
          },
        },
        UpdateRequest: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 200 },
            content: { type: "string", maxLength: 200000 },
          },
        },
      },
      responses: {
        ModerationBlocked: {
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
        RateLimited: {
          description: "Rate limited",
          headers: {
            "X-RateLimit-Limit": { schema: { type: "integer" } },
            "X-RateLimit-Remaining": { schema: { type: "integer" } },
            "X-RateLimit-Reset": { schema: { type: "integer" } },
            "Retry-After": { schema: { type: "integer" } },
          },
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
        Expired: {
          description:
            "Anonymous doc expired (7 days after creation, unless claimed)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string", example: "EXPIRED" },
                  message: { type: "string" },
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
