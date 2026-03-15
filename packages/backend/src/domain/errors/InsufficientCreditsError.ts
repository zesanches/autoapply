export class InsufficientCreditsError extends Error {
  override readonly name = "InsufficientCreditsError";
  readonly code = "INSUFFICIENT_CREDITS";

  constructor(
    public readonly available: number,
    public readonly required: number
  ) {
    super(
      `Insufficient credits: available=${available}, required=${required}`
    );
  }
}
