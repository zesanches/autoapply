import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { IQueueService } from "../../ports/IQueueService.js";
import { MaxRetriesExceededError } from "../../../domain/errors/MaxRetriesExceededError.js";

export interface RetryApplicationInput {
  userId: string;
  applicationId: string;
}

export interface RetryApplicationOutput {
  applicationId: string;
  attempts: number;
}

export class RetryApplicationUseCase {
  constructor(
    private readonly applicationRepository: IApplicationRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(input: RetryApplicationInput): Promise<RetryApplicationOutput> {
    const { userId, applicationId } = input;

    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    if (application.userId !== userId) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    if (!application.canRetry()) {
      if (application.hasExceededMaxAttempts()) {
        throw new MaxRetriesExceededError(applicationId, application.attempts);
      }
      throw new Error(
        `Application cannot be retried from status: ${application.status.value}`
      );
    }

    const retrying = application.transition("retrying");
    await this.applicationRepository.update(retrying);

    await this.queueService.enqueue("applications", {
      userId,
      jobId: application.jobId,
      applicationId,
    });

    return { applicationId, attempts: application.attempts };
  }
}
