import {
  ApplicationStatus,
  type ApplicationStatusValue,
} from "../value-objects/ApplicationStatus.js";

export interface ApplicationProps {
  id: string;
  userId: string;
  jobId: string;
  batchId: string | null;
  status: ApplicationStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  submittedAt: Date | null;
  formData: unknown | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Application {
  private constructor(private props: ApplicationProps) {}

  static create(props: Omit<ApplicationProps, "status"> & { status?: ApplicationStatus }): Application {
    return new Application({
      ...props,
      status: props.status ?? ApplicationStatus.initial(),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get jobId(): string {
    return this.props.jobId;
  }

  get batchId(): string | null {
    return this.props.batchId;
  }

  get status(): ApplicationStatus {
    return this.props.status;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get maxAttempts(): number {
    return this.props.maxAttempts;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }

  get submittedAt(): Date | null {
    return this.props.submittedAt;
  }

  hasExceededMaxAttempts(): boolean {
    return this.props.attempts >= this.props.maxAttempts;
  }

  canRetry(): boolean {
    return (
      this.props.status.value === "failed" && !this.hasExceededMaxAttempts()
    );
  }

  transition(next: ApplicationStatusValue): Application {
    const newStatus = this.props.status.transitionTo(next);
    const now = new Date();
    return new Application({
      ...this.props,
      status: newStatus,
      updatedAt: now,
      submittedAt: next === "submitted" ? now : this.props.submittedAt,
    });
  }

  incrementAttempts(): Application {
    return new Application({
      ...this.props,
      attempts: this.props.attempts + 1,
      updatedAt: new Date(),
    });
  }

  recordError(error: string): Application {
    return new Application({
      ...this.props,
      lastError: error,
      updatedAt: new Date(),
    });
  }
}
