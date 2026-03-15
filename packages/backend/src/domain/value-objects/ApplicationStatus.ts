export type ApplicationStatusValue =
  | "queued"
  | "applying"
  | "submitted"
  | "failed"
  | "retrying"
  | "exhausted";

const VALID_TRANSITIONS: Record<ApplicationStatusValue, ApplicationStatusValue[]> = {
  queued: ["applying"],
  applying: ["submitted", "failed"],
  submitted: [],
  failed: ["retrying"],
  retrying: ["applying", "exhausted"],
  exhausted: [],
};

export class ApplicationStatus {
  private constructor(private readonly _value: ApplicationStatusValue) {}

  static create(value: ApplicationStatusValue): ApplicationStatus {
    return new ApplicationStatus(value);
  }

  static initial(): ApplicationStatus {
    return new ApplicationStatus("queued");
  }

  get value(): ApplicationStatusValue {
    return this._value;
  }

  canTransitionTo(next: ApplicationStatusValue): boolean {
    const allowed = VALID_TRANSITIONS[this._value];
    return allowed !== undefined && allowed.includes(next);
  }

  transitionTo(next: ApplicationStatusValue): ApplicationStatus {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Invalid status transition: ${this._value} → ${next}`
      );
    }
    return new ApplicationStatus(next);
  }

  isTerminal(): boolean {
    return this._value === "submitted" || this._value === "exhausted";
  }

  equals(other: ApplicationStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
