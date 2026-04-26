/* eslint-disable react/no-unescaped-entities */
import { MarketingShell } from "@/components/MarketingShell";

export const metadata = {
  title: "Terms of Service · sendoc",
  description: "The rules for using sendoc.",
};

const LAST_UPDATED = "April 26, 2026";

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="prose prose-gray mx-auto max-w-3xl px-6 py-12">
        <h1>Terms of Service</h1>
        <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <p>
          By using sendoc you agree to these terms. If you don't, don't use sendoc.
        </p>

        <h2>The service</h2>
        <p>
          Sendoc lets you publish AI-generated documents as public links. Anyone
          with the share URL can read; anyone with the edit URL can modify.
          Documents are stored on our servers until removed.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>You may use sendoc anonymously or sign in with Google.</li>
          <li>You are responsible for the security of your account, your edit
            tokens, and your API keys. Treat them like passwords.</li>
          <li>If you discover unauthorized access, contact us and revoke the
            relevant credentials.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>You may not use sendoc to publish, distribute, or facilitate:</p>
        <ul>
          <li>Sexual content involving anyone under 18, real or fictional.</li>
          <li>Threats of violence against real, identifiable people.</li>
          <li>Instructions or encouragement for self-harm or suicide.</li>
          <li>Synthesis instructions for weapons of mass destruction or
            improvised explosives.</li>
          <li>Functional malicious code (malware, ransomware, exploit kits).</li>
          <li>Personal information about a private individual without their
            consent (doxxing).</li>
          <li>Content that infringes copyright, trademark, or other IP rights.</li>
          <li>Spam, phishing, or content designed to deceive readers.</li>
          <li>Automated abuse or attempts to circumvent rate limits.</li>
        </ul>

        <p>
          We use automated moderation and may also review documents manually in
          response to reports or proactive auditing. We may remove any document
          that violates these terms, suspend accounts, or revoke API keys
          without notice.
        </p>

        <h2>Your content</h2>
        <ul>
          <li>You retain ownership of documents you publish.</li>
          <li>By publishing, you grant sendoc a worldwide, royalty-free license
            to host, store, and serve the content as required to operate the
            service (i.e., to deliver the share URL to anyone you give it to).</li>
          <li>You represent that you have the rights to publish the content
            and that it doesn't violate the acceptable use rules.</li>
        </ul>

        <h2>API keys and connectors</h2>
        <ul>
          <li>API keys you generate at <a href="/settings/connectors">Connectors</a>{" "}
            are tied to your account. You're responsible for usage made with
            them.</li>
          <li>If you connect sendoc to a third-party AI tool (e.g., ChatGPT
            Custom GPT, Claude MCP), the third party's terms also apply.</li>
        </ul>

        <h2>Service availability</h2>
        <p>
          Sendoc is provided "as is" with no uptime guarantee. We may change,
          suspend, or discontinue features at any time. We make reasonable
          efforts to preserve your data but you should keep your own copies of
          anything important.
        </p>

        <h2>Termination</h2>
        <p>
          You can stop using sendoc at any time and request account deletion
          (see Privacy Policy). We may suspend or delete accounts that violate
          these terms or that show signs of abuse.
        </p>

        <h2>Liability</h2>
        <p>
          To the maximum extent permitted by law, sendoc and its operators are
          not liable for indirect, incidental, or consequential damages, lost
          profits, or lost data arising from use of the service. Total liability
          is capped at the amount you paid us in the 12 months preceding the
          claim (which, on free tiers, is zero).
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the State of California,
          USA, without regard to conflict-of-laws rules. Any dispute is to be
          brought in the state or federal courts of San Francisco County,
          California.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. Material changes will be announced in the
          app. Continued use after a change constitutes acceptance.
        </p>

        <h2>Contact</h2>
        <p>
          Questions: <a href="mailto:akhilrkn@gmail.com">akhilrkn@gmail.com</a>.
        </p>
      </article>
    </MarketingShell>
  );
}
