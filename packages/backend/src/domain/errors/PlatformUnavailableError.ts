export class PlatformUnavailableError extends Error {
  override readonly name = "PlatformUnavailableError";
  readonly code = "PLATFORM_UNAVAILABLE";

  constructor(public readonly platform: string, cause?: Error) {
    super(`Platform unavailable: ${platform}`);
    if (cause) this.cause = cause;
  }
}
