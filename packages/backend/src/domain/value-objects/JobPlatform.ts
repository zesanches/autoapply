export type JobPlatformValue = "indeed" | "linkedin";

const SUPPORTED_PLATFORMS: JobPlatformValue[] = ["indeed", "linkedin"];

export class JobPlatform {
  private constructor(private readonly _value: JobPlatformValue) {}

  static create(value: string): JobPlatform {
    const lower = value.toLowerCase().trim() as JobPlatformValue;
    if (!SUPPORTED_PLATFORMS.includes(lower)) {
      throw new Error(
        `Unsupported platform: ${value}. Supported: ${SUPPORTED_PLATFORMS.join(", ")}`
      );
    }
    return new JobPlatform(lower);
  }

  static supported(): JobPlatformValue[] {
    return [...SUPPORTED_PLATFORMS];
  }

  get value(): JobPlatformValue {
    return this._value;
  }

  equals(other: JobPlatform): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
