export type Plan = "FREE" | "PRO" | "ENTERPRISE";

const PLAN_LIMITS: Record<Plan, number> = {
  FREE: 10,
  PRO: 100,
  ENTERPRISE: Infinity,
};

export class CreditBalance {
  private constructor(
    private readonly _available: number,
    private readonly _reserved: number,
    private readonly _totalUsed: number,
    private readonly _plan: Plan
  ) {}

  static create(params: {
    available: number;
    reserved: number;
    totalUsed: number;
    plan: Plan;
  }): CreditBalance {
    if (params.available < 0) {
      throw new Error("Available credits cannot be negative");
    }
    if (params.reserved < 0) {
      throw new Error("Reserved credits cannot be negative");
    }
    if (params.totalUsed < 0) {
      throw new Error("Total used credits cannot be negative");
    }
    return new CreditBalance(
      params.available,
      params.reserved,
      params.totalUsed,
      params.plan
    );
  }

  static initial(plan: Plan): CreditBalance {
    const initialCredits = plan === "FREE" ? 10 : 0;
    return new CreditBalance(initialCredits, 0, 0, plan);
  }

  get available(): number {
    return this._available;
  }

  get reserved(): number {
    return this._reserved;
  }

  get totalUsed(): number {
    return this._totalUsed;
  }

  get plan(): Plan {
    return this._plan;
  }

  get monthlyLimit(): number {
    return PLAN_LIMITS[this._plan] ?? 0;
  }

  canReserve(amount: number): boolean {
    return amount > 0 && this._available >= amount;
  }

  reserve(amount: number): CreditBalance {
    if (amount <= 0) {
      throw new Error("Reserve amount must be positive");
    }
    if (!this.canReserve(amount)) {
      throw new Error(
        `Insufficient credits: available=${this._available}, requested=${amount}`
      );
    }
    return new CreditBalance(
      this._available - amount,
      this._reserved + amount,
      this._totalUsed,
      this._plan
    );
  }

  confirm(amount: number): CreditBalance {
    if (amount <= 0) {
      throw new Error("Confirm amount must be positive");
    }
    if (this._reserved < amount) {
      throw new Error(
        `Cannot confirm more than reserved: reserved=${this._reserved}, requested=${amount}`
      );
    }
    return new CreditBalance(
      this._available,
      this._reserved - amount,
      this._totalUsed + amount,
      this._plan
    );
  }

  rollback(amount: number): CreditBalance {
    if (amount <= 0) {
      throw new Error("Rollback amount must be positive");
    }
    if (this._reserved < amount) {
      throw new Error(
        `Cannot rollback more than reserved: reserved=${this._reserved}, requested=${amount}`
      );
    }
    return new CreditBalance(
      this._available + amount,
      this._reserved - amount,
      this._totalUsed,
      this._plan
    );
  }
}
