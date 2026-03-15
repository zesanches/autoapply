export interface ParsedResume {
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    description: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    endDate: string | null;
  }>;
  summary: string | null;
}

export interface IResumeParser {
  parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedResume>;
}
