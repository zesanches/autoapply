import type { IFormAnalyzer, FormAnalysis } from "../../application/ports/IFormAnalyzer.js";

export interface ClaudeProvider {
  complete(prompt: string): Promise<string>;
}

const ANALYZE_FORM_PROMPT = (html: string) => `\
You are a job application form analyzer. Analyze the HTML form below and extract its fields.

Return ONLY a valid JSON object (no markdown, no explanation) matching this exact schema:
{
  "fields": [
    {
      "name": string,
      "type": "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "file",
      "label": string,
      "required": boolean,
      "options": string[] | undefined
    }
  ],
  "submitSelector": string,
  "isMultiPage": boolean
}

Rules:
- "name" is the HTML input name/id attribute
- "submitSelector" is the CSS selector for the submit button (e.g. "button[type=submit]")
- "isMultiPage" is true if you detect pagination or "next" buttons in the form

HTML:
---
${html.slice(0, 20000)}
---`;

const MAP_PROFILE_PROMPT = (analysis: FormAnalysis, profileData: Record<string, unknown>) => `\
You are a form auto-filler. Map the candidate profile data to the form fields below.

Return ONLY a valid JSON object (no markdown, no explanation) where keys are field "name" values and values are strings to fill in.
Only include fields that can be filled from the profile. Skip file upload fields.

Form fields:
${JSON.stringify(analysis.fields, null, 2)}

Candidate profile:
${JSON.stringify(profileData, null, 2)}`;

export class ClaudeFormAnalyzer implements IFormAnalyzer {
  constructor(private readonly claude: ClaudeProvider) {}

  async analyzeForm(htmlContent: string): Promise<FormAnalysis> {
    const response = await this.claude.complete(ANALYZE_FORM_PROMPT(htmlContent));
    return this.parseAnalysis(response);
  }

  async mapProfileToForm(
    analysis: FormAnalysis,
    profileData: Record<string, unknown>
  ): Promise<Record<string, string>> {
    const response = await this.claude.complete(MAP_PROFILE_PROMPT(analysis, profileData));
    return this.parseMapping(response);
  }

  private parseAnalysis(raw: string): FormAnalysis {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as FormAnalysis;
    return {
      fields: Array.isArray(parsed.fields) ? parsed.fields : [],
      submitSelector: parsed.submitSelector ?? "button[type=submit]",
      isMultiPage: parsed.isMultiPage ?? false,
    };
  }

  private parseMapping(raw: string): Record<string, string> {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, string>;
    // Ensure all values are strings
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") result[k] = v;
      else if (v !== null && v !== undefined) result[k] = String(v);
    }
    return result;
  }
}
