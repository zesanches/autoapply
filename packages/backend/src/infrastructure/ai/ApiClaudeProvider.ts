import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeProvider } from "./ClaudeFormAnalyzer.js";

/**
 * Anthropic API provider — used in web/SaaS mode with user's API key.
 * The key is decrypted from the DB only at the time of use.
 */
export class ApiClaudeProvider implements ClaudeProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Unexpected response type from Claude API");
    }
    return content.text;
  }
}
