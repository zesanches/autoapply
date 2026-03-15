import { describe, it, expect, vi, beforeEach } from "vitest";
import { RetryApplicationUseCase } from "./RetryApplicationUseCase.js";
import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { IQueueService } from "../../ports/IQueueService.js";
import { Application } from "../../../domain/entities/Application.js";
import { ApplicationStatus } from "../../../domain/value-objects/ApplicationStatus.js";
import { MaxRetriesExceededError } from "../../../domain/errors/MaxRetriesExceededError.js";

function makeApplication(overrides: Partial<{
  userId: string;
  attempts: number;
  maxAttempts: number;
  status: ApplicationStatus;
}> = {}): Application {
  return Application.create({
    id: "app-1",
    userId: overrides.userId ?? "user-1",
    jobId: "job-1",
    batchId: null,
    status: overrides.status ?? ApplicationStatus.create("failed"),
    attempts: overrides.attempts ?? 1,
    maxAttempts: overrides.maxAttempts ?? 5,
    lastError: "Previous error",
    submittedAt: null,
    formData: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("RetryApplicationUseCase", () => {
  let applicationRepository: IApplicationRepository;
  let queueService: IQueueService;
  let useCase: RetryApplicationUseCase;

  beforeEach(() => {
    applicationRepository = {
      findById: vi.fn(),
      findByUserAndJob: vi.fn(),
      findMany: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };
    queueService = {
      enqueue: vi.fn().mockResolvedValue("q-1"),
      enqueueMany: vi.fn(),
    };
    useCase = new RetryApplicationUseCase(applicationRepository, queueService);
  });

  it("throws when application not found", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ userId: "user-1", applicationId: "app-1" })
    ).rejects.toThrow("Application not found: app-1");
  });

  it("throws when application belongs to a different user", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication({ userId: "other-user" })
    );

    await expect(
      useCase.execute({ userId: "user-1", applicationId: "app-1" })
    ).rejects.toThrow("Application not found: app-1");
  });

  it("throws MaxRetriesExceededError when attempts >= maxAttempts", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication({ attempts: 5, maxAttempts: 5 })
    );

    await expect(
      useCase.execute({ userId: "user-1", applicationId: "app-1" })
    ).rejects.toThrow(MaxRetriesExceededError);
  });

  it("throws when status is not retryable", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication({ status: ApplicationStatus.create("submitted") })
    );

    await expect(
      useCase.execute({ userId: "user-1", applicationId: "app-1" })
    ).rejects.toThrow("cannot be retried from status: submitted");
  });

  it("transitions to retrying and enqueues on success", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication()
    );

    const result = await useCase.execute({
      userId: "user-1",
      applicationId: "app-1",
    });

    expect(applicationRepository.update).toHaveBeenCalledOnce();
    expect(queueService.enqueue).toHaveBeenCalledWith(
      "applications",
      { userId: "user-1", jobId: "job-1", applicationId: "app-1" }
    );
    expect(result.applicationId).toBe("app-1");
  });
});
