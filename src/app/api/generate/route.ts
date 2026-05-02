// POST /api/generate
// Streams Claude's response into the doc:
// - Verifies the caller owns the doc
// - Streams chunks back over the response body (so the client knows when done)
// - Persists running content to Firestore every ~500ms so other listeners
//   (and the user's own snapshot subscription) see it live
//
// Body: { docId: string, prompt: string, model?: string }

import { NextRequest } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { anthropic, DEFAULT_MODEL, SENDOC_SYSTEM_PROMPT } from "@/lib/anthropic";
import { checkAndIncrementRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { moderate } from "@/lib/moderation";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds — adjust on Vercel if you need longer

export async function POST(req: NextRequest) {
  let decoded;
  try {
    decoded = await verifyIdToken(req.headers.get("authorization"));
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { docId, prompt, model } = await req.json();
  if (!docId || !prompt) {
    return new Response(JSON.stringify({ error: "docId and prompt required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Authorize: caller must own the doc.
  const docRef = adminDb().collection("docs").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
  if (snap.data()?.ownerId !== decoded.uid) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  // Pre-prompt moderation. Cheap classifier rejects obviously harmful
  // prompts before we spend Anthropic tokens or save anything.
  const promptCheck = await moderate(prompt, "prompt");
  if (promptCheck.flagged) {
    await adminDb().collection("moderationFlags").add({
      docId,
      ownerId: decoded.uid,
      source: "prompt",
      category: promptCheck.category ?? null,
      sample: prompt.slice(0, 500),
      createdAt: new Date(),
    });
    return new Response(
      JSON.stringify({
        error: "MODERATION_BLOCKED",
        message: "This prompt was blocked by our content policy.",
        category: promptCheck.category,
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  // Rate limit BEFORE we hit Anthropic — this is the abuse defense.
  // decoded.firebase.sign_in_provider is "anonymous" for anon users.
  const isAnon = decoded.firebase?.sign_in_provider === "anonymous";
  const rl = await checkAndIncrementRateLimit(decoded.uid, isAnon);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: "RATE_LIMIT",
        message: isAnon
          ? `You've used your ${rl.limit} free generations for today. Sign in with Google to get more, or wait until ${rl.resetAt.toUTCString()}.`
          : `Daily limit of ${rl.limit} reached. Resets at ${rl.resetAt.toUTCString()}.`,
        resetAt: rl.resetAt.toISOString(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(rl),
        },
      },
    );
  }

  // Build the streaming response body.
  const encoder = new TextEncoder();
  let accumulated = "";
  let lastSavedAt = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await anthropic.messages.stream({
          model: model || DEFAULT_MODEL,
          max_tokens: 8192,
          system: SENDOC_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            accumulated += chunk;
            controller.enqueue(encoder.encode(chunk));

            // Throttled persistence — every 500ms.
            const now = Date.now();
            if (now - lastSavedAt > 500) {
              lastSavedAt = now;
              // Don't await — fire-and-forget so streaming stays smooth.
              docRef
                .update({
                  content: accumulated,
                  contentSize: accumulated.length,
                  updatedAt: new Date(),
                })
                .catch((e: unknown) =>
                  console.error("[sendoc] mid-stream save failed", e),
                );
            }
          }
        }

        // Final flush.
        await docRef.update({
          content: accumulated,
          contentSize: accumulated.length,
          updatedAt: new Date(),
          "meta.wordCount": accumulated.split(/\s+/).filter(Boolean).length,
        });

        // Post-output moderation. The user already saw the streamed text
        // (we can't un-show it), but we DO want to prevent the share link
        // from publishing flagged content. So if flagged, deactivate the
        // share link + mark the doc as removed.
        const outputCheck = await moderate(accumulated, "output");
        if (outputCheck.flagged) {
          await docRef.update({
            "shareLink.active": false,
            status: "removed",
            updatedAt: new Date(),
          });
          await adminDb().collection("moderationFlags").add({
            docId,
            ownerId: decoded.uid,
            source: "output",
            category: outputCheck.category ?? null,
            sample: accumulated.slice(0, 500),
            createdAt: new Date(),
          });
          controller.enqueue(
            encoder.encode(
              `\n\n[sendoc: this output was flagged by our content policy and the share link has been disabled.]`,
            ),
          );
        }

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
