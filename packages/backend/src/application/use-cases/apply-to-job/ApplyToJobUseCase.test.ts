import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyToJobUseCase } from "./ApplyToJobUseCase.js";
import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { ICreditRepository } from "../../ports/ICreditRepository.js";
import type { IJobApplier } from "../../ports/IJobApplier.js";
import type { IProfileRepository } from "../../ports/IProfileRepository.js";
import { Application } from "../../../domain/entities/Application.js";
import { ApplicationStatus } from "../../../domain/value-objects/ApplicationStatus.js";
import { UserProfile } from "../../../domain/entities/UserProfile.js";
import { CreditBalance } from "../../../domain/value-objects/CreditBalance.js";
import { MaxRetriesExceededError } from "../../../domain/errors/MaxRetriesExceededError.js";
import { ProfileIncompleteError } from "../../../domain/errors/ProfileIncompleteError.js";

function makeApplication(overrides: Partial<{
  attempts: number;
  maxAttempts: number;
  status: ApplicationStatus;
}> = {}): Application {
  return Application.create({
    id: "app-1",
    userId: "user-1",
    jobId: "job-1",
    batchId: null,
    status: overrides.status ?? ApplicationStatus.initial(),
    attempts: overrides.attempts ?? 0,
    maxAttempts: overrides.maxAttempts ?? 5,
    lastError: null,
    submittedAt: null,
    formData: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeProfile(isComplete = true): UserProfile {
  return UserProfile.create({
    id: "profile-1",
    userId: "user-1",
    fullName: "John Doe",
    phone: null,
    location: null,
    linkedinUrl: null,
    portfolioUrl: null,
    resumeUrl: "https://example.com/resume.pdf",
    resumeData: { name: "John Doe" },
    skills: ["TypeScript"],
    experience: null,
    education: null,
    preferences: null,
    isComplete,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("ApplyToJobUseCase", () => {
  let applicationRepository: IApplicationRepository;
  let creditRepository: ICreditRepository;
  let profileRepository: IProfileRepository;
  let jobApplier: IJobApplier;
  let useCase: ApplyToJobUseCase;

  beforeEach(() => {
    applicationRepository = {
      findById: vi.fn(),
      findByUserAndJob: vi.fn(),
      findMany: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };
    creditRepository = {
      findBalanceByUserId: vi.fn(),
      saveBalance: vi.fn(),
      createTransaction: vi.fn(),
      findTransactions: vi.fn(),
    };
    profileRepository = {
      findByUserId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    jobApplier = {
      apply: vi.fn(),
    };
    useCase = new ApplyToJobUseCase(
      applicationRepository,
      creditRepository,
      profileRepository,
      jobApplier
    );
  });

  it("throws when application not found", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ userId: "user-1", jobId: "job-1", applicationId: "app-1" })
    ).rejects.toThrow("Application not found: app-1");
  });

  it("throws MaxRetriesExceededError when max attempts exceeded", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication({ attempts: 5, maxAttempts: 5 })
    );

    await expect(
      useCase.execute({ userId: "user-1", jobId: "job-1", applicationId: "app-1" })
    ).rejects.toThrow(MaxRetriesExceededError);
  });

  it("throws ProfileIncompleteError when profile is incomplete", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication()
    );
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(
      makeProfile(false)
    );

    await expect(
      useCase.execute({ userId: "user-1", jobId: "job-1", applicationId: "app-1" })
    ).rejects.toThrow(ProfileIncompleteError);
  });

  it("returns success on successful application", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication()
    );
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(jobApplier.apply).mockResolvedValueOnce({ success: true });
    const balance = CreditBalance.initial("FREE").reserve(1);
    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(balance);

    const result = await useCase.execute({
      userId: "user-1",
      jobId: "job-1",
      applicationId: "app-1",
    });

    expect(result.success).toBe(true);
    expect(result.applicationId).toBe("app-1");
    expect(creditRepository.saveBalance).toHaveBeenCalled();
  });

  it("records error and marks failed on applier failure", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication()
    );
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(jobApplier.apply).mockResolvedValueOnce({
      success: false,
      error: "Form submission failed",
    });

    const result = await useCase.execute({
      userId: "user-1",
      jobId: "job-1",
      applicationId: "app-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Form submission failed");
    expect(applicationRepository.update).toHaveBeenCalledTimes(2); // applying + failed
  });

  it("handles unexpected exceptions from jobApplier", async () => {
    vi.mocked(applicationRepository.findById).mockResolvedValueOnce(
      makeApplication()
    );
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(jobApplier.apply).mockRejectedValueOnce(new Error("Browser crash"));

    const result = await useCase.execute({
      userId: "user-1",
      jobId: "job-1",
      applicationId: "app-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Browser crash");
  });
});
