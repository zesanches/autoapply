export type CreditTransactionType = "PURCHASE" | "GRANT" | "DEBIT" | "REFUND";
export type CreditTransactionStatus =
  | "PENDING"
  | "RESERVED"
  | "CONFIRMED"
  | "ROLLED_BACK";

export interface CreditTransactionProps {
  id: string;
  balanceId: string;
  amount: number;
  type: CreditTransactionType;
  status: CreditTransactionStatus;
  reason: string | null;
  metadata: unknown | null;
  createdAt: Date;
}

export class CreditTransaction {
  private constructor(private readonly props: CreditTransactionProps) {}

  static create(props: CreditTransactionProps): CreditTransaction {
    if (props.amount === 0) {
      throw new Error("Credit transaction amount cannot be zero");
    }
    return new CreditTransaction(props);
  }

  get id(): string {
    return this.props.id;
  }

  get balanceId(): string {
    return this.props.balanceId;
  }

  get amount(): number {
    return this.props.amount;
  }

  get type(): CreditTransactionType {
    return this.props.type;
  }

  get status(): CreditTransactionStatus {
    return this.props.status;
  }
}
