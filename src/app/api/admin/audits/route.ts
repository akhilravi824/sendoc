import { NextRequest, NextResponse } from "next/server";
import type { Query, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req.headers.get("authorization"), [
      "moderator",
      "admin",
      "super_admin",
    ]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    const code = msg === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: msg || "Unauthorized" }, { status: code });
  }

  // ?type=action returns the per-action log (doc.publish/edit/...)
  // anything else returns the admin moderation log (takedown/role/...)
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "action" ? "action" : "admin";
  const collection = type === "action" ? "actionAudits" : "adminAudits";

  // Optional filters. Action and target.id can be applied as Firestore
  // equality predicates (cheap, indexed). Free-text search is applied
  // post-fetch on the result set since Firestore doesn't support it
  // and we already cap at 200 rows.
  const action = sp.get("action") || undefined;
  const docId = sp.get("docId") || undefined;
  const actorUid = sp.get("actorUid") || undefined;
  const search = (sp.get("q") || "").trim().toLowerCase();

  let q: Query = adminDb().collection(collection);
  if (action) q = q.where("action", "==", action);
  if (docId) q = q.where("target.id", "==", docId);
  if (actorUid) q = q.where("actor.uid", "==", actorUid);
  q = q.orderBy("createdAt", "desc").limit(200);

  let snap;
  try {
    snap = await q.get();
  } catch (e) {
    // Composite index missing on this filter combination — surface a
    // helpful error so admins know to add it.
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json(
      { error: "QUERY_FAILED", message, hint: "Likely a missing Firestore composite index for this filter combination." },
      { status: 500 },
    );
  }

  type AuditRow = {
    id: string;
    action: string;
    actor: unknown;
    target: unknown;
    reason: string | null;
    diff: unknown;
    meta: unknown;
    createdAt: number | null;
  };

  let audits: AuditRow[] = snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      action: data.action,
      actor: data.actor ?? null,
      target: data.target ?? null,
      reason: data.reason ?? null,
      diff: data.diff ?? null,
      meta: data.meta ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? null,
    };
  });

  if (search) {
    audits = audits.filter((a) => {
      return (
        JSON.stringify(a.actor ?? "").toLowerCase().includes(search) ||
        JSON.stringify(a.target ?? "").toLowerCase().includes(search) ||
        JSON.stringify(a.meta ?? "").toLowerCase().includes(search) ||
        (a.reason ?? "").toLowerCase().includes(search) ||
        a.action.toLowerCase().includes(search)
      );
    });
  }

  return NextResponse.json({ type, audits, filters: { action, docId, actorUid, search } });
}
