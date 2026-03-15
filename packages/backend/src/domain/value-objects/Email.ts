const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(private readonly _value: string) {}

  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      throw new Error("Email cannot be empty");
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      throw new Error(`Invalid email format: ${value}`);
    }
    if (trimmed.length > 254) {
      throw new Error("Email exceeds maximum length of 254 characters");
    }
    return new Email(trimmed);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
