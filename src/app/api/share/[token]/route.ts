import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { expiryFor, isExpired } from "@/lib/link-ttl";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const { token } = params;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const snap = await adminDb()
    .collection("docs")
    .where("shareLink.token", "==", token)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = snap.docs[0].data();
  if (data.shareLink?.active === false || data.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isExpired(data)) {
    return NextResponse.json(
      {
        error: "EXPIRED",
        message:
          "This share link has expired. Anonymous docs are removed after 7 days unless claimed.",
        expiredAt: expiryFor(data),
      },
      { status: 410 },
    );
  }

  // Private links require a signed-in (non-anonymous) Firebase user.
  // The publisher chose "private" at publish time — we don't enforce
  // that the viewer is a *specific* person, just that they have a
  // sendoc account. Pairs with an honor-system notice on the page.
  const visibility: "public" | "private" =
    data.shareLink?.visibility === "private" ? "private" : "public";
  if (visibility === "private") {
    try {
      const decoded = await verifyIdToken(req.headers.get("authorization"));
      if (decoded.firebase?.sign_in_provider === "anonymous") {
        return NextResponse.json(
          {
            error: "AUTH_REQUIRED",
            message: "Sign in to view this private document.",
            visibility: "private",
          },
          { status: 401 },
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: "AUTH_REQUIRED",
          message: "Sign in to view this private document.",
          visibility: "private",
        },
        { status: 401 },
      );
    }
  }

  return NextResponse.json({
    title: data.title ?? "Untitled",
    content: data.content ?? "",
    updatedAt: data.updatedAt?.toMillis?.() ?? null,
    expiresAt: expiryFor(data),
    visibility,
  });
}
