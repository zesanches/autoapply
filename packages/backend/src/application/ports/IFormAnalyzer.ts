export interface FormField {
  name: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "file";
  label: string;
  required: boolean;
  options?: string[] | undefined;
}

export interface FormAnalysis {
  fields: FormField[];
  submitSelector: string;
  isMultiPage: boolean;
}

export interface IFormAnalyzer {
  analyzeForm(htmlContent: string): Promise<FormAnalysis>;
  mapProfileToForm(
    analysis: FormAnalysis,
    profileData: Record<string, unknown>
  ): Promise<Record<string, string>>;
}
