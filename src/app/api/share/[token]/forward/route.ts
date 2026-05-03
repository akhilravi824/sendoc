// POST /api/share/[token]/forward
//
// "Forward this share link to a friend's email." Different from the
// collaborator-invite flow on /api/docs/[docId]/collaborators which
// is owner-only and creates persistent permissions. This endpoint
// is for ANY viewer of the public share page — they just want to
// pass the link along by email.
//
// No persistent record beyond the audit log. Recipient receives an
// email with the share URL; they click it, land on /d/<token>, view
// the doc. No account required on either side.
//
// Defenses:
// - Per-IP rate limit (5/hour) — same shape as /api/publish.
// - Optional: pre-prompt moderation on the personal note (skipped for
//   v1 since the note is short and doesn't generate AI output).
// - Resend's own abuse protections for the SMTP layer.

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isExpired } from "@/lib/link-ttl";
import { isResendConfigured } from "@/lib/email";
import { Resend } from "resend";
import { logAction } from "@/lib/audit/action";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const ip = getClientIp(req);

  // Per-IP throttle. 5/hour is generous for normal sharing but stops
  // a leaked share URL from being scripted into a spam blast.
  const rl = await checkIpRateLimit(ip, "share_forward", 5, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "RATE_LIMIT",
        message: "Too many forwards from this IP. Try again later.",
      },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { to?: string; fromName?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const to = (body.to ?? "").trim().toLowerCase();
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: "INVALID_EMAIL", message: "Enter a valid email address." },
      { status: 400 },
    );
  }
  const fromName = (body.fromName ?? "").trim().slice(0, 80);
  const note = (body.note ?? "").trim().slice(0, 400);

  // Validate the doc exists, is active, and isn't expired.
  const snap = await adminDb()
    .collection("docs")
    .where("shareLink.token", "==", params.token)
    .limit(1)
    .get();
  if (snap.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = snap.docs[0].data();
  if (
    doc.shareLink?.active === false ||
    doc.status !== "active"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isExpired(doc)) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  const shareUrl = `${base}/d/${params.token}`;
  const docTitle = doc.title || "Untitled";

  if (!isResendConfigured()) {
    // No Resend yet — return the URL + a mailto: link so the user
    // can open their own email client. Better than failing.
    const mailto =
      `mailto:${encodeURIComponent(to)}` +
      `?subject=${encodeURIComponent(`${fromName || "A friend"} shared a doc with you`)}` +
      `&body=${encodeURIComponent(
        `${note ? note + "\n\n" : ""}Open the doc: ${shareUrl}`,
      )}`;
    return NextResponse.json({
      ok: true,
      sent: false,
      mailto,
      shareUrl,
      message:
        "Email isn't configured yet — opening your email client instead.",
    });
  }

  const FROM = process.env.SENDOC_FROM_EMAIL || "sendoc <onboarding@resend.dev>";
  const subject = `${fromName || "A friend"} shared "${docTitle}" with you`;
  const text = [
    `${fromName || "Someone"} shared a doc with you on sendoc.`,
    "",
    note ? `Their note:\n${note}\n` : "",
    "Open the doc:",
    shareUrl,
    "",
    "— sendoc",
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 4px 0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7c3aed;">sendoc</p>
          <h1 style="margin:8px 0 16px 0;font-size:22px;font-weight:600;color:#0a0a14;line-height:1.3;">
            ${escapeHtml(fromName || "Someone")} shared a doc with you
          </h1>
          <p style="margin:0 0 20px 0;font-size:15px;color:#4b5563;line-height:1.6;">
            <strong>${escapeHtml(docTitle)}</strong>
          </p>
          ${
            note
              ? `<blockquote style="margin:0 0 20px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid #d1d5db;font-style:italic;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(note).replace(/\n/g, "<br>")}</blockquote>`
              : ""
          }
          <a href="${escapeHtml(shareUrl)}"
             style="display:inline-block;background:#0a0a14;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:10px;font-size:14px;font-weight:600;">
            Open doc →
          </a>
          <p style="margin:24px 0 0 0;font-size:11px;color:#9ca3af;line-height:1.5;word-break:break-all;">
            Or paste this URL: <a href="${escapeHtml(shareUrl)}" style="color:#7c3aed;">${escapeHtml(shareUrl)}</a>
          </p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0 0;font-size:11px;color:#9ca3af;">© sendoc · One canvas. Every mind.</p>
    </td></tr>
  </table>
</body></html>`;

  try {
    const client = new Resend(process.env.RESEND_API_KEY!);
    const result = await client.emails.send({
      from: FROM,
      to,
      subject,
      text,
      html,
      replyTo: undefined,
    });
    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          sent: false,
          error: "EMAIL_FAILED",
          message: result.error.message ?? "Email failed to send.",
          shareUrl,
        },
        { status: 502 },
      );
    }

    logAction({
      action: "doc.share",
      actor: { type: "anonymous", ip, userAgent: req.headers.get("user-agent") },
      docId: doc.docId,
      meta: { forwardedTo: to, fromName: fromName || null },
    });

    return NextResponse.json({
      ok: true,
      sent: true,
      shareUrl,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        error: "EMAIL_FAILED",
        message: e instanceof Error ? e.message : "unknown",
        shareUrl,
      },
      { status: 502 },
    );
  }
}
