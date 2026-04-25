// POST /api/docs
// Creates a new doc owned by the authenticated user.
// Body: { mode: "ai_generate" | "blank", prompt?: string, title?: string }
// Returns: { docId, shareUrl }
//
// The actual AI generation happens in /api/generate, called by the client
// after navigation to the new doc page. This separation lets the link be
// "live" before the AI finishes (matches the "ngrok of AI content" promise).

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyIdToken(req.headers.get("authorization"));
    const body = await req.json();
    const mode: "ai_generate" | "blank" = body.mode || "blank";
    const promptText: string | undefined = body.prompt;
    const titleHint: string | undefined = body.title;

    const docId = uuidv4();
    const linkToken = uuidv4();
    const now = new Date();

    // Cheap title inference: first 60 chars of prompt, else "Untitled".
    const title =
      titleHint ||
      (promptText
        ? promptText.slice(0, 60).replace(/\s+/g, " ").trim()
        : "Untitled document");

    await adminDb()
      .collection("docs")
      .doc(docId)
      .set({
        docId,
        title,
        ownerId: decoded.uid,
        ownerEmail: decoded.email ?? null,
        content: "",
        contentSize: 0,
        status: "active",
        createdAt: now,
        updatedAt: now,
        shareLink: {
          token: linkToken,
          ttl: null, // Sprint 3 implements TTLs by plan
          createdAt: now,
          active: true,
        },
        meta: {
          aiModel: mode === "ai_generate" ? "claude-sonnet-4-6" : null,
          mode,
          wordCount: 0,
        },
      });

    return NextResponse.json(
      {
        docId,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/d/${linkToken}`,
        title,
        status: "active",
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "MISSING_TOKEN" || msg.includes("verify"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
