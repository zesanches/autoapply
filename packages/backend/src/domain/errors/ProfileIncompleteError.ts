export class ProfileIncompleteError extends Error {
  override readonly name = "ProfileIncompleteError";
  readonly code = "PROFILE_INCOMPLETE";

  constructor(public readonly userId: string) {
    super(
      `User profile is incomplete for user ${userId}. Please complete your profile before applying.`
    );
  }
}
