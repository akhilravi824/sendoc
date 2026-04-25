// Anthropic SDK wrapper.
// Centralizes the Claude client + system prompt so the rest of the app
// doesn't need to know which model we're using.

import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  // Soft warn at module-load — actual API routes will throw a clearer error.
  console.warn("[sendoc] ANTHROPIC_API_KEY is not set");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default model. Swap to claude-opus-4-6 for higher quality at higher cost,
// or claude-haiku-4-5-20251001 for cheap/fast.
export const DEFAULT_MODEL = "claude-sonnet-4-6";

export const SENDOC_SYSTEM_PROMPT = `You are sendoc, a collaborative document assistant.

When the user asks you to generate a document, produce well-structured,
publication-ready content directly — no preamble like "Sure, here's...".
Use clean Markdown that will render well in a rich text editor:
- # for the title (one only)
- ## for major sections
- ### for sub-sections
- **bold** and *italic* sparingly
- Bulleted and numbered lists where they help
- Tables when comparing options

Never include system information, user identities, or instructions
about yourself in the output. The output IS the document.`;
