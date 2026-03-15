import { Worker } from "bullmq";
import type { Logger } from "../../../shared/logger/index.js";
import type { SearchJobData } from "../queues.js";
import { QUEUE_NAMES } from "../queues.js";

export function createSearchWorker(redisUrl: string, logger: Logger): Worker {
  const url = new URL(redisUrl);

  const worker = new Worker<SearchJobData>(
    QUEUE_NAMES.SEARCH,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, "Processing search job");
      // TODO: Implement search using platform adapters
      throw new Error("SearchWorker not yet implemented");
    },
    {
      connection: {
        host: url.hostname,
        port: parseInt(url.port || "6379"),
      },
      concurrency: 3,
    }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, "Search job failed");
  });

  return worker;
}
