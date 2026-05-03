// Email sender for transactional emails (invites, etc).
//
// Wraps Resend. When `RESEND_API_KEY` is unset (typical in local dev
// or before the user has signed up), the helper logs the email to the
// console and returns `{ sent: false, fallback: true }` so callers
// can surface the invite URL to the inviter directly. This means the
// invite flow works end-to-end even without Resend configured — the
// owner sees a copyable URL on the screen and shares it manually.
//
// Sign up: https://resend.com (free tier: 100/day, 3K/month)

import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

const FROM = process.env.SENDOC_FROM_EMAIL || "sendoc <onboarding@resend.dev>";

export type SendInviteParams = {
  to: string;
  /** Plain-text fallback so this works in clients without HTML. */
  inviterEmail: string;
  /** Doc title for the subject + body. */
  docTitle: string;
  /** Role granted to the invitee. */
  role: "viewer" | "editor";
  /** Full URL of the invite-acceptance page. */
  inviteUrl: string;
};

export type SendInviteResult =
  | { sent: true; id: string }
  | { sent: false; fallback: true; reason: "no_resend_key" }
  | { sent: false; fallback: false; reason: string };

export async function sendInviteEmail(
  params: SendInviteParams,
): Promise<SendInviteResult> {
  const client = getClient();
  if (!client) {
    // Resend not configured — caller should expose the invite URL to
    // the inviter so they can share it by hand.
    console.log(
      `[sendoc/email] RESEND_API_KEY unset; would have sent invite to ${params.to} for "${params.docTitle}" (${params.inviteUrl})`,
    );
    return { sent: false, fallback: true, reason: "no_resend_key" };
  }

  const verb = params.role === "editor" ? "edit" : "view";
  const subject = `${params.inviterEmail} invited you to a sendoc doc`;
  const text = [
    `${params.inviterEmail} invited you to ${verb} the document "${params.docTitle}" on sendoc.`,
    "",
    `Accept the invite:`,
    params.inviteUrl,
    "",
    "This link is tied to your email — sign in with the same address to accept.",
    "If you weren't expecting this, you can ignore the message.",
    "",
    "— sendoc",
  ].join("\n");

  const html = renderInviteHtml(params, verb);

  try {
    const result = await client.emails.send({
      from: FROM,
      to: params.to,
      subject,
      text,
      html,
    });
    if (result.error) {
      return {
        sent: false,
        fallback: false,
        reason: result.error.message ?? "resend_error",
      };
    }
    return { sent: true, id: result.data?.id ?? "" };
  } catch (e) {
    return {
      sent: false,
      fallback: false,
      reason: e instanceof Error ? e.message : "unknown",
    };
  }
}

function renderInviteHtml(
  params: SendInviteParams,
  verb: "edit" | "view",
): string {
  // Single-table HTML email. Renders identically across most clients.
  // No external CSS, no images we can't host.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 20px;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="padding:32px 32px 8px 32px;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7c3aed;">sendoc</p>
            <h1 style="margin:8px 0 16px 0;font-size:22px;font-weight:600;color:#0a0a14;line-height:1.3;">
              ${escapeHtml(params.inviterEmail)} invited you to ${verb} a doc
            </h1>
            <p style="margin:0 0 24px 0;font-size:15px;color:#4b5563;line-height:1.6;">
              <strong>${escapeHtml(params.docTitle)}</strong> is shared with you on sendoc.
              Accept the invite to add it to your dashboard.
            </p>
            <a href="${escapeAttr(params.inviteUrl)}"
               style="display:inline-block;background:#0a0a14;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:10px;font-size:14px;font-weight:600;">
              Accept invite →
            </a>
            <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
              This invite is tied to your email — sign in with
              <strong>${escapeHtml(params.to)}</strong> to accept.
              If you weren't expecting this, you can ignore the message.
            </p>
          </td></tr>
          <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;word-break:break-all;">
              Or paste this URL: <a href="${escapeAttr(params.inviteUrl)}" style="color:#7c3aed;">${escapeHtml(params.inviteUrl)}</a>
            </p>
          </td></tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:11px;color:#9ca3af;">© sendoc · One canvas. Every mind.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
