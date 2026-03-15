export interface CreditDeductedPayload {
  userId: string;
  balanceId: string;
  amount: number;
  reason: string;
  applicationId: string;
}

export class CreditDeducted {
  readonly type = "credit.deducted" as const;
  readonly occurredAt = new Date();

  constructor(public readonly payload: CreditDeductedPayload) {}
}
