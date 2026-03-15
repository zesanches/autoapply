export interface ApplyToJobInput {
  userId: string;
  jobId: string;
  applicationId: string;
}

export interface ApplyToJobOutput {
  success: boolean;
  applicationId: string;
  submittedAt?: Date | undefined;
  error?: string | undefined;
}
