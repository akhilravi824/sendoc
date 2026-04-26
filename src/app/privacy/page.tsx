/* eslint-disable react/no-unescaped-entities */
import { MarketingShell } from "@/components/MarketingShell";

export const metadata = {
  title: "Privacy Policy · sendoc",
  description: "How sendoc collects, uses, and protects your data.",
};

const LAST_UPDATED = "April 26, 2026";

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="prose prose-gray mx-auto max-w-3xl px-6 py-12">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <p>
          This policy explains what information sendoc collects, how we use it,
          and the choices you have. Sendoc is a service for publishing AI-generated
          documents as shareable public links.
        </p>

        <h2>What we collect</h2>
        <h3>Information you give us</h3>
        <ul>
          <li>
            <strong>Account info</strong> — when you sign in with Google, we receive
            your email address, display name, and Google account ID. Anonymous
            accounts have only an opaque identifier and no personal data.
          </li>
          <li>
            <strong>Documents you publish</strong> — the title and body of every
            document you create through the website, our API, or a connected AI
            tool (e.g. ChatGPT or Claude).
          </li>
          <li>
            <strong>Reports</strong> — when someone reports a shared document, we
            store the doc ID, the reporter's identifier (if any), and the reason.
          </li>
        </ul>

        <h3>Information we collect automatically</h3>
        <ul>
          <li>
            <strong>Usage logs</strong> — the IP address of requests to our API,
            timestamps, and the endpoint called. Used for rate limiting and abuse
            prevention.
          </li>
          <li>
            <strong>Error reports</strong> — when our app encounters an error, we
            log it (including stack trace and limited context) via Sentry to
            diagnose bugs.
          </li>
        </ul>

        <h3>What we do NOT collect</h3>
        <ul>
          <li>We do not sell your data.</li>
          <li>We do not run ad-tracking or third-party analytics.</li>
          <li>We do not use your published documents to train AI models.</li>
        </ul>

        <h2>How we use the information</h2>
        <ul>
          <li>To run the service: store and serve documents, authenticate you,
            issue and validate share links and API keys.</li>
          <li>To enforce content policy and respond to abuse reports — sendoc
            administrators may review documents flagged by automated moderation
            or by users.</li>
          <li>To prevent abuse: per-user and per-IP rate limits depend on
            usage signals.</li>
          <li>To debug: error reports and limited request logs.</li>
        </ul>

        <h2>How documents are shared</h2>
        <p>
          When you publish a document, sendoc returns a public read URL of the
          form <code>/d/&lt;token&gt;</code>. Anyone holding this URL can view the
          document. We also return an edit URL of the form{" "}
          <code>/edit/&lt;editToken&gt;</code>, which lets anyone holding it edit
          or delete the document. We never list or index your documents publicly;
          the only way to find a document is via the URL you choose to share.
        </p>

        <h2>Content moderation</h2>
        <p>
          Every published document is screened by an automated content classifier
          before the share link goes live. Documents that match our prohibited
          categories are blocked and recorded. Sendoc administrators may also
          manually review and remove documents in response to reports.
        </p>

        <h2>Data retention</h2>
        <ul>
          <li>Published documents persist until you (or an administrator) delete
            them.</li>
          <li>Rate-limit counters expire after 7 days.</li>
          <li>Error reports are retained per Sentry's default policy (90 days).</li>
          <li>Audit log entries (admin actions) are retained for legal/compliance
            reasons.</li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Delete a document</strong> — open its edit URL and click
            Delete; or, if you signed in with Google, delete it from your
            dashboard.
          </li>
          <li>
            <strong>Revoke an API key</strong> — visit{" "}
            <a href="/settings/connectors">Connectors</a> in your account.
          </li>
          <li>
            <strong>Delete your account</strong> — sign in and visit the account
            settings, or contact us to request a complete deletion. We will
            remove your profile, documents, and personal identifiers within 30
            days.
          </li>
        </ul>

        <h2>Third parties</h2>
        <ul>
          <li><strong>Google Firebase</strong> — authentication and Firestore
            database. Google's privacy policy applies to the data stored there.</li>
          <li><strong>Anthropic</strong> — the API we call to run content
            moderation classifiers. We send the text being moderated; we do not
            send your identity.</li>
          <li><strong>Vercel</strong> — hosting. Standard server logs apply.</li>
          <li><strong>Sentry</strong> — error tracking. Stack traces and limited
            request context.</li>
        </ul>

        <h2>Children</h2>
        <p>
          Sendoc is not directed to children under 13 (or the equivalent
          minimum age in your jurisdiction). Don't use sendoc if you don't meet
          that minimum age.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy. Material changes will be announced in the
          app. Continued use after a change constitutes acceptance.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or deletion requests:{" "}
          <a href="mailto:akhilrkn@gmail.com">akhilrkn@gmail.com</a>.
        </p>
      </article>
    </MarketingShell>
  );
}
