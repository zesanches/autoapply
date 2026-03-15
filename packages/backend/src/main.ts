import { createContainer } from "./shared/container/di.js";
import { startServer } from "./infrastructure/http/server.js";
import { logger } from "./shared/logger/index.js";

async function main(): Promise<void> {
  logger.info("Starting AutoApply API...");

  const container = createContainer();

  // Run Prisma migrations in development
  if (process.env["NODE_ENV"] === "development") {
    const { execSync } = await import("child_process");
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
    } catch {
      logger.warn("Could not run migrations — DB may not be ready yet");
    }
  }

  await startServer(container);
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
