import type { CreditBalance } from "../../domain/value-objects/CreditBalance.js";
import type { CreditTransaction } from "../../domain/entities/Credit.js";

export interface ICreditRepository {
  findBalanceByUserId(userId: string): Promise<CreditBalance | null>;
  saveBalance(userId: string, balance: CreditBalance): Promise<void>;
  createTransaction(transaction: CreditTransaction): Promise<void>;
  findTransactions(userId: string, page?: number, perPage?: number): Promise<{
    items: CreditTransaction[];
    total: number;
  }>;
}
