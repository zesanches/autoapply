export interface ApplicationSubmittedPayload {
  applicationId: string;
  userId: string;
  jobId: string;
  platform: string;
  submittedAt: Date;
}

export class ApplicationSubmitted {
  readonly type = "application.submitted" as const;
  readonly occurredAt = new Date();

  constructor(public readonly payload: ApplicationSubmittedPayload) {}
}
