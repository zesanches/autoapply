export interface ApplicationFailedPayload {
  applicationId: string;
  userId: string;
  jobId: string;
  platform: string;
  error: string;
  attempts: number;
  isExhausted: boolean;
}

export class ApplicationFailed {
  readonly type = "application.failed" as const;
  readonly occurredAt = new Date();

  constructor(public readonly payload: ApplicationFailedPayload) {}
}
