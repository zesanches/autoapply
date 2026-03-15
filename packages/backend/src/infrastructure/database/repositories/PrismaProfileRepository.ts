import type { PrismaClient } from "@prisma/client";
import type { IProfileRepository } from "../../../application/ports/IProfileRepository.js";
import type { UserProfile } from "../../../domain/entities/UserProfile.js";

export class PrismaProfileRepository implements IProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(_userId: string): Promise<UserProfile | null> {
    throw new Error("Not implemented");
  }

  async save(_profile: UserProfile): Promise<void> {
    throw new Error("Not implemented");
  }

  async delete(_userId: string): Promise<void> {
    throw new Error("Not implemented");
  }
}
