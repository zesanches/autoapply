import { Worker } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "../../../shared/logger/index.js";
import type { ApplicationJobData } from "../queues.js";
import { QUEUE_NAMES } from "../queues.js";
import { BrowserPool } from "../../browser/BrowserPool.js";
import { IndeedAdapter } from "../../browser/IndeedAdapter.js";
import { ClaudeFormAnalyzer } from "../../ai/ClaudeFormAnalyzer.js";
import { LocalClaudeProvider } from "../../ai/LocalClaudeProvider.js";
import { PrismaApplicationRepository } from "../../database/repositories/PrismaApplicationRepository.js";
import { PrismaProfileRepository } from "../../database/repositories/PrismaProfileRepository.js";
import { PrismaCreditRepository } from "../../database/repositories/PrismaCreditRepository.js";

const RETRY_BACKOFF_BASE_MS = 30_000;

export interface ApplicationWorkerDeps {
  prisma: PrismaClient;
  browserPool: BrowserPool;
  logger: Logger;
}

export function createApplicationWorker(
  redisUrl: string,
  deps: ApplicationWorkerDeps
): Worker {
  const { prisma, browserPool, logger } = deps;

  const applicationRepository = new PrismaApplicationRepository(prisma);
  const profileRepository = new PrismaProfileRepository(prisma);
  const creditRepository = new PrismaCreditRepository(prisma);

  const claudeProvider = new LocalClaudeProvider();
  const formAnalyzer = new ClaudeFormAnalyzer(claudeProvider);

  const url = new URL(redisUrl);

  const worker = new Worker<ApplicationJobData>(
    QUEUE_NAMES.APPLICATIONS,
    async (job) => {
      const { userId, jobId, batchId } = job.data;
      const jobLog = logger.child({ bullJobId: job.id, userId, jobId, batchId });

      jobLog.info("Processing application job");

      // 1. Fetch application record (lookup by userId + jobId composite key)
      const application = await applicationRepository.findByUserAndJob(userId, jobId);
      if (!application) {
        jobLog.warn("Application record not found — skipping");
        return;
      }

      // 2. Fetch job listing
      const jobListing = await prisma.jobListing.findUnique({ where: { id: jobId } });
      if (!jobListing) {
        jobLog.warn("JobListing not found — skipping");
        return;
      }

      // 3. Fetch user profile
      const profile = await profileRepository.findByUserId(userId);
      if (!profile) {
        jobLog.warn("User profile not found — skipping");
        return;
      }

      // 4. Transition to APPLYING
      let current = application.incrementAttempts().transition("applying");
      await applicationRepository.update(current);

      // 5. Acquire browser context
      let context;
      try {
        context = await browserPool.acquire();
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        jobLog.error({ error }, "Failed to acquire browser context");
        current = current.transition("failed").recordError(error);
        await applicationRepository.update(current);
        throw err;
      }

      try {
        // 6. Run platform adapter
        const profileData = profile.toJSON();
        const adapter = new IndeedAdapter(context, formAnalyzer);
        const result = await adapter.apply(
          { url: jobListing.url },
          {
            resumeUrl: profileData.resumeUrl,
            resumeData: profileData.resumeData as Record<string, unknown> | null,
          }
        );

        if (result.success) {
          // 7a. Confirm credit + mark submitted
          const balance = await creditRepository.findBalanceByUserId(userId);
          if (balance) {
            const newBalance = balance.confirm(1);
            await creditRepository.saveBalance(userId, newBalance);
          }

          current = current.transition("submitted");
          if (result.formData) {
            // formData stored via update — we need to persist it
            await prisma.application.update({
              where: { id: current.id },
              data: {
                status: "SUBMITTED",
                submittedAt: current.submittedAt ?? new Date(),
                formData: result.formData,
                attempts: current.attempts,
              },
            });
          } else {
            await applicationRepository.update(current);
          }

          jobLog.info("Application submitted successfully");
        } else {
          // 7b. Handle failure
          const error = result.error ?? "unknown_error";
          jobLog.warn({ error }, "Application failed");

          current = current.recordError(error).transition("failed");

          if (current.hasExceededMaxAttempts()) {
            // Rollback credit
            const balance = await creditRepository.findBalanceByUserId(userId);
            if (balance) {
              const newBalance = balance.rollback(1);
              await creditRepository.saveBalance(userId, newBalance);
            }
            // failed → retrying → exhausted (two valid transitions per state machine)
            current = current.transition("retrying").transition("exhausted");
            await applicationRepository.update(current);
            jobLog.warn("Max attempts exceeded — application exhausted");
          } else {
            // Enqueue retry with backoff
            const delay = RETRY_BACKOFF_BASE_MS * Math.pow(2, current.attempts - 1);
            current = current.transition("retrying");
            await applicationRepository.update(current);
            await job.moveToDelayed(Date.now() + delay);
            jobLog.info({ delay, attempts: current.attempts }, "Scheduled retry");
          }
        }
      } finally {
        await browserPool.release(context);
      }
    },
    {
      connection: {
        host: url.hostname,
        port: parseInt(url.port || "6379"),
      },
      concurrency: 2,
      limiter: {
        max: 1,
        duration: 45_000, // 1 job per 45s anti-spam
      },
    }
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Application job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, "Application job failed");
  });

  return worker;
}
