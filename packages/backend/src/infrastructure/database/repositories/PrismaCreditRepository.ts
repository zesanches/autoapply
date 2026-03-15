import type { PrismaClient } from "@prisma/client";
import type { ICreditRepository } from "../../../application/ports/ICreditRepository.js";
import { CreditBalance } from "../../../domain/value-objects/CreditBalance.js";
import type { Plan } from "../../../domain/value-objects/CreditBalance.js";
import type { CreditTransaction } from "../../../domain/entities/Credit.js";

function toDomainPlan(plan: string): Plan {
  return plan as Plan;
}

export class PrismaCreditRepository implements ICreditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBalanceByUserId(userId: string): Promise<CreditBalance | null> {
    const row = await this.prisma.creditBalance.findUnique({ where: { userId } });
    if (!row) return null;
    return CreditBalance.create({
      available: row.available,
      reserved: row.reserved,
      totalUsed: row.totalUsed,
      plan: toDomainPlan(row.plan),
    });
  }

  async saveBalance(userId: string, balance: CreditBalance): Promise<void> {
    await this.prisma.creditBalance.upsert({
      where: { userId },
      create: {
        userId,
        available: balance.available,
        reserved: balance.reserved,
        totalUsed: balance.totalUsed,
        plan: balance.plan,
      },
      update: {
        available: balance.available,
        reserved: balance.reserved,
        totalUsed: balance.totalUsed,
        plan: balance.plan,
      },
    });
  }

  async createTransaction(_transaction: CreditTransaction): Promise<void> {
    throw new Error("Not implemented");
  }

  async findTransactions(
    _userId: string,
    _page?: number,
    _perPage?: number
  ): Promise<{ items: CreditTransaction[]; total: number }> {
    throw new Error("Not implemented");
  }
}
