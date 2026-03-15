import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../logger/index.js";
import { Encryption } from "../crypto/encryption.js";
import { PrismaUserRepository } from "../../infrastructure/database/repositories/PrismaUserRepository.js";
import { PrismaProfileRepository } from "../../infrastructure/database/repositories/PrismaProfileRepository.js";
import { PrismaApplicationRepository } from "../../infrastructure/database/repositories/PrismaApplicationRepository.js";
import { PrismaCreditRepository } from "../../infrastructure/database/repositories/PrismaCreditRepository.js";
import { BullMQService } from "../../infrastructure/queue/BullMQService.js";
import { BrowserPool } from "../../infrastructure/browser/BrowserPool.js";
import { BrowserJobSearcher } from "../../infrastructure/browser/BrowserJobSearcher.js";
import { SearchJobsUseCase } from "../../application/use-cases/search-jobs/SearchJobsUseCase.js";
import { BatchApplyUseCase } from "../../application/use-cases/batch-apply/BatchApplyUseCase.js";
import { ApplyToJobUseCase } from "../../application/use-cases/apply-to-job/ApplyToJobUseCase.js";
import { RetryApplicationUseCase } from "../../application/use-cases/retry-application/RetryApplicationUseCase.js";
import { CreateUserProfileUseCase } from "../../application/use-cases/create-user-profile/CreateUserProfileUseCase.js";
import { GetDashboardStatsUseCase } from "../../application/use-cases/get-dashboard-stats/GetDashboardStatsUseCase.js";

export interface Container {
  prisma: PrismaClient;
  encryption: Encryption;
  useCases: {
    searchJobs: SearchJobsUseCase;
    batchApply: BatchApplyUseCase;
    applyToJob: ApplyToJobUseCase;
    retryApplication: RetryApplicationUseCase;
    createUserProfile: CreateUserProfileUseCase;
    getDashboardStats: GetDashboardStatsUseCase;
  };
}

export function createContainer(): Container {
  const prisma = new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

  const encryption = new Encryption(env.ENCRYPTION_KEY);

  const userRepository = new PrismaUserRepository(prisma);
  const profileRepository = new PrismaProfileRepository(prisma);
  const applicationRepository = new PrismaApplicationRepository(prisma);
  const creditRepository = new PrismaCreditRepository(prisma);

  const queueService = new BullMQService(env.REDIS_URL);

  const browserPool = new BrowserPool({ maxInstances: env.MAX_BROWSER_INSTANCES });
  const browserJobSearcher = new BrowserJobSearcher(browserPool);

  // Placeholder applier — real impl in browser/adapters
  const placeholderApplier = {
    apply: async () => {
      throw new Error("No job applier configured");
    },
  };

  const searchJobs = new SearchJobsUseCase(browserJobSearcher);
  const batchApply = new BatchApplyUseCase(
    applicationRepository,
    creditRepository,
    profileRepository,
    queueService
  );
  const applyToJob = new ApplyToJobUseCase(
    applicationRepository,
    creditRepository,
    profileRepository,
    placeholderApplier
  );
  const retryApplication = new RetryApplicationUseCase(
    applicationRepository,
    queueService
  );
  const createUserProfile = new CreateUserProfileUseCase(profileRepository);
  const getDashboardStats = new GetDashboardStatsUseCase(
    applicationRepository,
    creditRepository
  );

  logger.info("DI container initialized");

  return {
    prisma,
    encryption,
    useCases: {
      searchJobs,
      batchApply,
      applyToJob,
      retryApplication,
      createUserProfile,
      getDashboardStats,
    },
  };
}
