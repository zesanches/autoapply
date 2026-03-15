export class MaxRetriesExceededError extends Error {
  override readonly name = "MaxRetriesExceededError";
  readonly code = "MAX_RETRIES_EXCEEDED";

  constructor(
    public readonly applicationId: string,
    public readonly attempts: number
  ) {
    super(
      `Max retries exceeded for application ${applicationId}: ${attempts} attempts`
    );
  }
}
