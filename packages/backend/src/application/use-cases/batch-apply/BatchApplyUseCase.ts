import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { ICreditRepository } from "../../ports/ICreditRepository.js";
import type { IQueueService } from "../../ports/IQueueService.js";
import type { IProfileRepository } from "../../ports/IProfileRepository.js";
import { InsufficientCreditsError } from "../../../domain/errors/InsufficientCreditsError.js";
import { ProfileIncompleteError } from "../../../domain/errors/ProfileIncompleteError.js";
import { Application } from "../../../domain/entities/Application.js";
import { ApplicationStatus } from "../../../domain/value-objects/ApplicationStatus.js";

const BATCH_JOB_BASE_DELAY_MS = 60_000;
const BATCH_JOB_JITTER_MS = 30_000;

export interface BatchApplyInput {
  userId: string;
  jobIds: string[];
}

export interface BatchApplyOutput {
  batchId: string;
  enqueued: number;
  skipped: number;
}

export class BatchApplyUseCase {
  constructor(
    private readonly applicationRepository: IApplicationRepository,
    private readonly creditRepository: ICreditRepository,
    private readonly profileRepository: IProfileRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(input: BatchApplyInput): Promise<BatchApplyOutput> {
    const { userId, jobIds } = input;

    // Check profile completeness
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile || !profile.isComplete) {
      throw new ProfileIncompleteError(userId);
    }

    // Filter out already-applied jobs
    const existing = await Promise.all(
      jobIds.map((jobId) =>
        this.applicationRepository.findByUserAndJob(userId, jobId)
      )
    );
    const newJobIds = jobIds.filter((_, i) => existing[i] === null);
    const skipped = jobIds.length - newJobIds.length;

    if (newJobIds.length === 0) {
      return { batchId: "", enqueued: 0, skipped };
    }

    // Check and reserve credits
    const balance = await this.creditRepository.findBalanceByUserId(userId);
    if (!balance || !balance.canReserve(newJobIds.length)) {
      throw new InsufficientCreditsError(
        balance?.available ?? 0,
        newJobIds.length
      );
    }
    const newBalance = balance.reserve(newJobIds.length);
    await this.creditRepository.saveBalance(userId, newBalance);

    // Generate batch ID
    const batchId = `batch-${userId}-${Date.now()}`;

    // Create application records and enqueue jobs
    const jobs = newJobIds.map((jobId, i) => {
      const delay =
        i * (BATCH_JOB_BASE_DELAY_MS + Math.floor(Math.random() * BATCH_JOB_JITTER_MS));
      return { jobId, delay };
    });

    for (const { jobId } of jobs) {
      const application = Application.create({
        id: `app-${userId}-${jobId}-${Date.now()}`,
        userId,
        jobId,
        batchId,
        status: ApplicationStatus.initial(),
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
        submittedAt: null,
        formData: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.applicationRepository.save(application);
    }

    const queueJobs = jobs.map(({ jobId, delay }) => ({
      data: { userId, jobId, batchId },
      options: { delay },
    }));
    await this.queueService.enqueueMany("applications", queueJobs);

    return { batchId, enqueued: newJobIds.length, skipped };
  }
}
