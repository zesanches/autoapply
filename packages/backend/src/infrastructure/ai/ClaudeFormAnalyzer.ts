import type { IFormAnalyzer, FormAnalysis } from "../../application/ports/IFormAnalyzer.js";

export interface ClaudeProvider {
  complete(prompt: string): Promise<string>;
}

/**
 * Implements IFormAnalyzer using Claude AI to analyze job application forms.
 */
export class ClaudeFormAnalyzer implements IFormAnalyzer {
  constructor(private readonly claude: ClaudeProvider) {}

  async analyzeForm(_htmlContent: string): Promise<FormAnalysis> {
    throw new Error("ClaudeFormAnalyzer not yet implemented");
  }

  async mapProfileToForm(
    _analysis: FormAnalysis,
    _profileData: Record<string, unknown>
  ): Promise<Record<string, string>> {
    throw new Error("ClaudeFormAnalyzer not yet implemented");
  }
}
