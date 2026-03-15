import type { UserProfile } from "../../domain/entities/UserProfile.js";

export interface IProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
  delete(userId: string): Promise<void>;
}
