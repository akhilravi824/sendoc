// POST /api/edit/[editToken]/ai
//
// Token-gated AI edit. Anyone with the editToken can ask Claude to modify
// the doc. Server streams the updated content back over the response body.
//
// The endpoint does NOT auto-save — it returns the proposed updated
// content. The client decides whether to apply it (gives the user a
// preview-and-confirm UX so AI can't silently destroy work).
//
// Defenses:
// - Per-IP rate limit (10/hour) — same model as /api/publish
// - Per-doc rate limit (30/day) — prevents one shared editToken from
//   burning unlimited Anthropic spend
// - Pre-prompt moderation on the user's instruction
// - Post-output moderation on the AI's response (caller still has to
//   apply — but flagging here gives admins a paper trail)

import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { anthropic, DEFAULT_MODEL } from "@/lib/anthropic";
import { moderate } from "@/lib/moderation";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { lookupHashes, pepperedHash } from "@/lib/secret-hash";
import { logAction } from "@/lib/audit/action";
import { isExpired } from "@/lib/link-ttl";

export const runtime = "nodejs";
export const maxDuration = 60;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

const SYSTEM_PROMPT = `You are sendoc, an AI editor working on a shared document.

The user will give you an instruction (e.g., "add a hotel section", "make this more concise", "translate to Spanish"). Apply that instruction to the document and output the COMPLETE updated document.

Critical rules:
- Output ONLY the updated document body. No preamble, no explanation, no "Here is..." prefix.
- Preserve the existing structure unless the user asks you to change it.
- Match the existing format. If the doc is Markdown, output Markdown. If it's HTML, output HTML. Detect from the input.
- For Markdown: # for the title (one only), ## for major sections, **bold** sparingly, lists where they help, tables when comparing.
- Never add system metadata, AI disclaimers, or "edited by AI" notes — the user is editing collaboratively, not asking AI to label its work.
- If the instruction is ambiguous, make the most reasonable interpretation.
- If the instruction asks for harmful content, refuse by outputting the unchanged document with no other text.`;

export async function POST(
  req: NextRequest,
  { params }: { params: { editToken: string } },
) {
  const ip = getClientIp(req);

  // Per-IP throttle.
  const ipLimit = await checkIpRateLimit(ip, "ai_edit", 10, 60 * 60);
  if (!ipLimit.ok) {
    return new Response(
      JSON.stringify({
        error: "RATE_LIMIT",
        message: "Too many AI edits from this IP. Try again later.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(ipLimit),
        },
      },
    );
  }

  // Look up doc by editToken hash. Try peppered + legacy in one query so
  // existing tokens keep working through the migration.
  const [newHash, oldHash] = lookupHashes(params.editToken);
  const snap = await adminDb()
    .collection("docs")
    .where("editTokenHash", "in", [newHash, oldHash])
    .limit(1)
    .get();
  if (snap.empty) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const docRef = snap.docs[0].ref;
  const doc = snap.docs[0].data();
  if (doc.status !== "active") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (isExpired(doc)) {
    return new Response(JSON.stringify({ error: "EXPIRED" }), {
      status: 410,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (doc.editTokenHash !== newHash) {
    docRef
      .update({ editTokenHash: pepperedHash(params.editToken) })
      .catch(() => undefined);
  }

  // Per-doc throttle.
  const docLimit = await checkIpRateLimit(
    `doc_${doc.docId}`,
    "ai_edit_doc",
    30,
    24 * 60 * 60,
  );
  if (!docLimit.ok) {
    return new Response(
      JSON.stringify({
        error: "DOC_RATE_LIMIT",
        message: "This doc has hit its daily AI-edit limit. Try again tomorrow.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(docLimit),
        },
      },
    );
  }

  let body: { instruction?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_BODY" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const instruction = (body.instruction ?? "").trim();
  if (!instruction) {
    return new Response(
      JSON.stringify({ error: "MISSING_INSTRUCTION" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (instruction.length > 2000) {
    return new Response(
      JSON.stringify({ error: "INSTRUCTION_TOO_LONG" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Pre-prompt moderation.
  const promptCheck = await moderate(instruction, "prompt");
  if (promptCheck.flagged) {
    await adminDb().collection("moderationFlags").add({
      docId: doc.docId,
      ownerId: doc.ownerId ?? null,
      source: "ai_edit_prompt",
      ip,
      category: promptCheck.category ?? null,
      sample: instruction.slice(0, 500),
      createdAt: new Date(),
    });
    return new Response(
      JSON.stringify({
        error: "MODERATION_BLOCKED",
        message: "This instruction was blocked by our content policy.",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  // Build the user message: current doc + instruction.
  // We split into two content blocks so we can cache the doc content
  // (the heavy, repeated part) but always pass the instruction fresh.
  // The `cache_control` field is supported by the Anthropic API but not
  // typed in our SDK version (0.32.1). Casting until we upgrade.
  const docBlock = `Current document:
\`\`\`
${doc.content ?? ""}
\`\`\``;
  const userBlocks = [
    {
      type: "text" as const,
      text: docBlock,
      cache_control: { type: "ephemeral" as const },
    },
    { type: "text" as const, text: `Instruction: ${instruction}` },
  ] as unknown as Parameters<typeof anthropic.messages.stream>[0]["messages"][number]["content"];

  const systemBlocks = [
    {
      type: "text" as const,
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" as const },
    },
  ] as unknown as Parameters<typeof anthropic.messages.stream>[0]["system"];

  const encoder = new TextEncoder();
  let accumulated = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await anthropic.messages.stream({
          model: body.model || DEFAULT_MODEL,
          max_tokens: 8192,
          system: systemBlocks,
          messages: [{ role: "user", content: userBlocks }],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            accumulated += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        // Post-output moderation. We don't auto-apply, but we log if
        // flagged so admin can spot abuse patterns even if the user
        // never clicks Apply.
        const outputCheck = await moderate(accumulated, "output");
        if (outputCheck.flagged) {
          await adminDb().collection("moderationFlags").add({
            docId: doc.docId,
            ownerId: doc.ownerId ?? null,
            source: "ai_edit_output",
            ip,
            category: outputCheck.category ?? null,
            sample: accumulated.slice(0, 500),
            createdAt: new Date(),
          });
          // Append a sentinel so the client knows.
          controller.enqueue(
            encoder.encode(
              `\n\n[sendoc: this output was flagged by our content policy. Do not apply.]`,
            ),
          );
        }

        // Legacy audit collection — keeps aiEditAudits as the
        // AI-specific paper trail for moderation review.
        await adminDb().collection("aiEditAudits").add({
          docId: doc.docId,
          ownerId: doc.ownerId ?? null,
          ip,
          instructionSample: instruction.slice(0, 500),
          outputSize: accumulated.length,
          flagged: outputCheck.flagged,
          createdAt: new Date(),
        });

        // Unified action-audit entry. Mirrors doc.publish/edit/etc so
        // a single query reconstructs a doc's full history.
        const ownerUid = doc.ownerId ?? null;
        logAction({
          action: "doc.ai_edit",
          actor: ownerUid
            ? {
                type: "user",
                uid: ownerUid,
                email: doc.ownerEmail ?? null,
                ip,
              }
            : { type: "anonymous", ip },
          docId: doc.docId,
          meta: {
            instructionSample: instruction.slice(0, 200),
            outputSize: accumulated.length,
            flagged: outputCheck.flagged,
            model: body.model || DEFAULT_MODEL,
          },
        });

        // Stamp the doc with last-AI-edit timestamp (not the new content
        // — caller decides whether to apply).
        await docRef
          .update({ "meta.lastAiEditAt": new Date() })
          .catch(() => undefined);

        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Streaming error";
        controller.enqueue(encoder.encode(`\n\n[sendoc error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
