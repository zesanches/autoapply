import { PrismaClient } from "@prisma/client";
import { env } from "./shared/config/env.js";
import { logger } from "./shared/logger/index.js";
import { BrowserPool } from "./infrastructure/browser/BrowserPool.js";
import { createApplicationWorker } from "./infrastructure/queue/workers/ApplicationWorker.js";
import { createSearchWorker } from "./infrastructure/queue/workers/SearchWorker.js";

async function main(): Promise<void> {
  logger.info("Starting AutoApply Worker...");

  const prisma = new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  const browserPool = new BrowserPool({ maxInstances: env.MAX_BROWSER_INSTANCES });

  const applicationWorker = createApplicationWorker(env.REDIS_URL, {
    prisma,
    browserPool,
    logger,
  });
  const searchWorker = createSearchWorker(env.REDIS_URL, logger);

  logger.info("Workers started");

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down workers...");
    await Promise.all([
      applicationWorker.close(),
      searchWorker.close(),
    ]);
    await browserPool.close();
    await prisma.$disconnect();
    logger.info("Workers shut down gracefully");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal worker startup error");
  process.exit(1);
});
