import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { ICreditRepository } from "../../ports/ICreditRepository.js";
import type { IJobApplier } from "../../ports/IJobApplier.js";
import type { IProfileRepository } from "../../ports/IProfileRepository.js";
import type { ApplyToJobInput, ApplyToJobOutput } from "./ApplyToJobDTO.js";
import { ProfileIncompleteError } from "../../../domain/errors/ProfileIncompleteError.js";
import { MaxRetriesExceededError } from "../../../domain/errors/MaxRetriesExceededError.js";

export class ApplyToJobUseCase {
  constructor(
    private readonly applicationRepository: IApplicationRepository,
    private readonly creditRepository: ICreditRepository,
    private readonly profileRepository: IProfileRepository,
    private readonly jobApplier: IJobApplier
  ) {}

  async execute(input: ApplyToJobInput): Promise<ApplyToJobOutput> {
    const { userId, jobId, applicationId } = input;

    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    if (application.hasExceededMaxAttempts()) {
      throw new MaxRetriesExceededError(applicationId, application.attempts);
    }

    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile || !profile.isComplete) {
      throw new ProfileIncompleteError(userId);
    }

    // Transition to applying
    const applying = application.transition("applying").incrementAttempts();
    await this.applicationRepository.update(applying);

    try {
      const result = await this.jobApplier.apply(
        // JobListing resolved by the worker from jobId
        { id: jobId } as never,
        profile
      );

      if (result.success) {
        const submitted = applying.transition("submitted");
        await this.applicationRepository.update(submitted);

        // Confirm credit deduction
        const balance = await this.creditRepository.findBalanceByUserId(userId);
        if (balance) {
          await this.creditRepository.saveBalance(userId, balance.confirm(1));
        }

        return {
          success: true,
          applicationId,
          submittedAt: submitted.submittedAt ?? undefined,
        };
      } else {
        const failed = applying
          .transition("failed")
          .recordError(result.error ?? "Unknown error");
        await this.applicationRepository.update(failed);

        return { success: false, applicationId, error: result.error };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unexpected error";
      const failed = applying.transition("failed").recordError(error);
      await this.applicationRepository.update(failed);

      return { success: false, applicationId, error };
    }
  }
}
