import { describe, it, expect, vi, beforeEach } from "vitest";
import { BatchApplyUseCase } from "./BatchApplyUseCase.js";
import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { ICreditRepository } from "../../ports/ICreditRepository.js";
import type { IQueueService } from "../../ports/IQueueService.js";
import type { IProfileRepository } from "../../ports/IProfileRepository.js";
import { InsufficientCreditsError } from "../../../domain/errors/InsufficientCreditsError.js";
import { ProfileIncompleteError } from "../../../domain/errors/ProfileIncompleteError.js";
import { CreditBalance } from "../../../domain/value-objects/CreditBalance.js";
import { UserProfile } from "../../../domain/entities/UserProfile.js";

function makeProfile(isComplete = true): UserProfile {
  return UserProfile.create({
    id: "profile-1",
    userId: "user-1",
    fullName: "John Doe",
    phone: null,
    location: "São Paulo",
    linkedinUrl: null,
    portfolioUrl: null,
    resumeUrl: "https://example.com/resume.pdf",
    resumeData: { name: "John Doe" },
    skills: ["TypeScript", "Node.js"],
    experience: null,
    education: null,
    preferences: null,
    isComplete,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("BatchApplyUseCase", () => {
  let applicationRepository: IApplicationRepository;
  let creditRepository: ICreditRepository;
  let profileRepository: IProfileRepository;
  let queueService: IQueueService;
  let useCase: BatchApplyUseCase;

  beforeEach(() => {
    applicationRepository = {
      findById: vi.fn(),
      findByUserAndJob: vi.fn().mockResolvedValue(null),
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
    queueService = {
      enqueue: vi.fn(),
      enqueueMany: vi.fn().mockResolvedValue(["q1", "q2"]),
    };
    useCase = new BatchApplyUseCase(
      applicationRepository,
      creditRepository,
      profileRepository,
      queueService
    );
  });

  it("throws ProfileIncompleteError when profile is null", async () => {
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ userId: "user-1", jobIds: ["job-1"] })
    ).rejects.toThrow(ProfileIncompleteError);
  });

  it("throws ProfileIncompleteError when profile is incomplete", async () => {
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(
      makeProfile(false)
    );

    await expect(
      useCase.execute({ userId: "user-1", jobIds: ["job-1"] })
    ).rejects.toThrow(ProfileIncompleteError);
  });

  it("throws InsufficientCreditsError when balance is null", async () => {
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ userId: "user-1", jobIds: ["job-1"] })
    ).rejects.toThrow(InsufficientCreditsError);
  });

  it("throws InsufficientCreditsError when insufficient credits", async () => {
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(
      CreditBalance.create({ available: 0, reserved: 0, totalUsed: 0, plan: "FREE" })
    );

    await expect(
      useCase.execute({ userId: "user-1", jobIds: ["job-1"] })
    ).rejects.toThrow(InsufficientCreditsError);
  });

  it("skips already-applied jobs", async () => {
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(
      CreditBalance.initial("FREE")
    );
    // job-1 already applied, job-2 is new
    vi.mocked(applicationRepository.findByUserAndJob)
      .mockResolvedValueOnce({ id: "existing" } as never)
      .mockResolvedValueOnce(null);

    const result = await useCase.execute({
      userId: "user-1",
      jobIds: ["job-1", "job-2"],
    });

    expect(result.skipped).toBe(1);
    expect(result.enqueued).toBe(1);
  });

  it("returns empty result when all jobs are already applied", async () => {
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(applicationRepository.findByUserAndJob).mockResolvedValue(
      { id: "existing" } as never
    );

    const result = await useCase.execute({
      userId: "user-1",
      jobIds: ["job-1"],
    });

    expect(result.enqueued).toBe(0);
    expect(result.skipped).toBe(1);
    expect(queueService.enqueueMany).not.toHaveBeenCalled();
  });

  it("reserves credits and enqueues jobs on happy path", async () => {
    const balance = CreditBalance.initial("FREE");
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce(makeProfile());
    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(balance);

    const result = await useCase.execute({
      userId: "user-1",
      jobIds: ["job-1", "job-2"],
    });

    expect(creditRepository.saveBalance).toHaveBeenCalledTimes(1);
    expect(applicationRepository.save).toHaveBeenCalledTimes(2);
    expect(queueService.enqueueMany).toHaveBeenCalledWith(
      "applications",
      expect.arrayContaining([
        expect.objectContaining({ data: { userId: "user-1", jobId: "job-1", batchId: expect.any(String) } }),
        expect.objectContaining({ data: { userId: "user-1", jobId: "job-2", batchId: expect.any(String) } }),
      ])
    );
    expect(result.enqueued).toBe(2);
    expect(result.batchId).toBeTruthy();
  });
});
