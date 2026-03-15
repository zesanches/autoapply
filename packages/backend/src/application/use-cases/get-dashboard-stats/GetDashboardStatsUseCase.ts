import type { IApplicationRepository } from "../../ports/IApplicationRepository.js";
import type { ICreditRepository } from "../../ports/ICreditRepository.js";

export interface GetDashboardStatsInput {
  userId: string;
}

export interface DashboardStats {
  totalApplications: number;
  submitted: number;
  failed: number;
  pending: number;
  creditsAvailable: number;
  creditsUsed: number;
}

export class GetDashboardStatsUseCase {
  constructor(
    private readonly applicationRepository: IApplicationRepository,
    private readonly creditRepository: ICreditRepository
  ) {}

  async execute(input: GetDashboardStatsInput): Promise<DashboardStats> {
    const { userId } = input;

    const [allApps, submittedApps, failedApps, balance] = await Promise.all([
      this.applicationRepository.findMany({ userId, perPage: 1 }),
      this.applicationRepository.findMany({ userId, status: "submitted", perPage: 1 }),
      this.applicationRepository.findMany({
        userId,
        status: "exhausted",
        perPage: 1,
      }),
      this.creditRepository.findBalanceByUserId(userId),
    ]);

    const pending = allApps.total - submittedApps.total - failedApps.total;

    return {
      totalApplications: allApps.total,
      submitted: submittedApps.total,
      failed: failedApps.total,
      pending: Math.max(0, pending),
      creditsAvailable: balance?.available ?? 0,
      creditsUsed: balance?.totalUsed ?? 0,
    };
  }
}
