import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetDashboardStatsUseCase } from "./GetDashboardStatsUseCase.js";
import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { ICreditRepository } from "../../ports/ICreditRepository.js";
import { CreditBalance } from "../../../domain/value-objects/CreditBalance.js";

describe("GetDashboardStatsUseCase", () => {
  let applicationRepository: IApplicationRepository;
  let creditRepository: ICreditRepository;
  let useCase: GetDashboardStatsUseCase;

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
    useCase = new GetDashboardStatsUseCase(applicationRepository, creditRepository);
  });

  it("returns aggregated stats", async () => {
    vi.mocked(applicationRepository.findMany)
      .mockResolvedValueOnce({ items: [], total: 10 }) // all
      .mockResolvedValueOnce({ items: [], total: 6 }) // submitted
      .mockResolvedValueOnce({ items: [], total: 2 }); // exhausted

    const balance = CreditBalance.create({
      available: 7,
      reserved: 0,
      totalUsed: 3,
      plan: "FREE",
    });
    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(balance);

    const result = await useCase.execute({ userId: "user-1" });

    expect(result.totalApplications).toBe(10);
    expect(result.submitted).toBe(6);
    expect(result.failed).toBe(2);
    expect(result.pending).toBe(2);
    expect(result.creditsAvailable).toBe(7);
    expect(result.creditsUsed).toBe(3);
  });

  it("returns zero stats when no applications or balance", async () => {
    vi.mocked(applicationRepository.findMany).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(null);

    const result = await useCase.execute({ userId: "user-1" });

    expect(result.totalApplications).toBe(0);
    expect(result.creditsAvailable).toBe(0);
    expect(result.creditsUsed).toBe(0);
  });

  it("pending never goes below zero", async () => {
    vi.mocked(applicationRepository.findMany)
      .mockResolvedValueOnce({ items: [], total: 5 }) // all
      .mockResolvedValueOnce({ items: [], total: 4 }) // submitted
      .mockResolvedValueOnce({ items: [], total: 4 }); // exhausted (overlap edge case)

    vi.mocked(creditRepository.findBalanceByUserId).mockResolvedValueOnce(null);

    const result = await useCase.execute({ userId: "user-1" });

    expect(result.pending).toBeGreaterThanOrEqual(0);
  });
});
