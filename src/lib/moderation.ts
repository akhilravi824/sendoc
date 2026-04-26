// Content moderation. Runs on prompts (before sending to Claude) and on
// outputs (before saving to Firestore + share link). Uses Anthropic Claude
// Haiku as the classifier — fast, cheap (~$0.001/check), and lets us avoid
// adding a second AI provider just for moderation.
//
// Trade-off: same vendor as the generator. If you need adversarial
// independence (defence in depth across vendors) swap to OpenAI's
// moderation API or Perspective API. Free, but adds another key to manage.

import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic";

export type ModerationResult = {
  flagged: boolean;
  category?: string;
  reason?: string;
};

const MODERATION_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a content safety classifier. Decide if the given text falls into ANY of these categories:

- sexual_content_minors: any sexual content involving anyone under 18, real or fictional
- violence_threats: explicit threats of violence against a real, identifiable person
- self_harm_instruction: instructions or encouragement for suicide or self-harm
- weapons_instruction: synthesis of bioweapons, chemical weapons, or improvised explosives
- malware_instruction: working malicious code (ransomware, exploit kits) intended to harm
- doxxing: real personal info (full name + address/phone) of a private individual

Be strict but practical. Generic mentions of these topics in journalism, fiction, education, or harm-reduction contexts are NOT flagged. Only flag content that would actively cause harm if executed or published.

Respond with EXACTLY one of these formats:
- "OK" if the text is safe
- "FLAG: <category>" if not safe (use one of the categories above)

Nothing else. No explanation.`;

export async function moderate(
  text: string,
  source: "prompt" | "output",
): Promise<ModerationResult> {
  if (!text || text.trim().length === 0) {
    return { flagged: false };
  }
  // Cap input to keep latency + cost predictable. 4000 chars is plenty
  // for classification.
  const sample = text.slice(0, 4000);

  try {
    const res = await anthropic.messages.create({
      model: MODERATION_MODEL,
      max_tokens: 32,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `[Source: ${source}]\n\n${sample}` }],
    });

    const block = res.content[0];
    if (!block || block.type !== "text") {
      // Couldn't parse — fail open. Better than blocking legitimate content.
      console.warn("[moderation] unexpected response shape", res);
      return { flagged: false };
    }
    const verdict = block.text.trim();
    if (verdict.startsWith("FLAG:")) {
      const category = verdict.slice("FLAG:".length).trim().toLowerCase();
      return {
        flagged: true,
        category,
        reason: `Content flagged as ${category}.`,
      };
    }
    return { flagged: false };
  } catch (e) {
    // If the moderation call itself fails, fail open with a log.
    // We don't want a transient Anthropic outage to block all generation.
    console.error("[moderation] classifier call failed", e);
    return { flagged: false };
  }
}

// Keep this around so callers can downcast errors uniformly.
export class ModerationError extends Error {
  constructor(
    public readonly result: ModerationResult,
    public readonly source: "prompt" | "output",
  ) {
    super(result.reason || "Content moderation flagged this request.");
    this.name = "ModerationError";
  }
}

// Hush unused-export warnings if anyone re-exports the SDK type.
export type { Anthropic };
