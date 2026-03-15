import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import type { IResumeParser, ParsedResume } from "../../application/ports/IResumeParser.js";
import type { ClaudeProvider } from "./ClaudeFormAnalyzer.js";

const PARSE_PROMPT = (text: string) => `\
You are a resume parser. Extract structured data from the resume text below.

Return ONLY a valid JSON object (no markdown, no explanation) matching this exact schema:
{
  "fullName": string,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "skills": string[],
  "experience": [{ "company": string, "title": string, "startDate": string, "endDate": string | null, "description": string }],
  "education": [{ "institution": string, "degree": string, "field": string, "endDate": string | null }],
  "summary": string | null
}

Resume text:
---
${text}
---`;

export class ClaudeResumeParser implements IResumeParser {
  constructor(private readonly claude: ClaudeProvider) {}

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedResume> {
    const text = await this.extractText(fileBuffer, mimeType);
    const response = await this.claude.complete(PARSE_PROMPT(text));
    return this.parseResponse(response);
  }

  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // plain text
    return buffer.toString("utf8");
  }

  private parseResponse(raw: string): ParsedResume {
    // Strip possible markdown code block wrappers
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedResume;

    return {
      fullName: parsed.fullName ?? "",
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      location: parsed.location ?? null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      summary: parsed.summary ?? null,
    };
  }
}
