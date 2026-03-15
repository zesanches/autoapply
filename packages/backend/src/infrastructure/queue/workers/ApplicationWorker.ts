import { Worker } from "bullmq";
import type { Logger } from "../../../shared/logger/index.js";
import type { ApplicationJobData } from "../queues.js";
import { QUEUE_NAMES } from "../queues.js";

export function createApplicationWorker(
  redisUrl: string,
  logger: Logger
): Worker {
  const url = new URL(redisUrl);

  const worker = new Worker<ApplicationJobData>(
    QUEUE_NAMES.APPLICATIONS,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, "Processing application job");
      // TODO: Implement full application flow using BrowserPool + platform adapters
      throw new Error("ApplicationWorker not yet implemented");
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
