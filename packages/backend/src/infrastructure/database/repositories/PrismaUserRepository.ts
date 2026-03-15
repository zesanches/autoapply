import type { PrismaClient } from "@prisma/client";
import type { IUserRepository } from "../../../application/ports/IUserRepository.js";
import type { User } from "../../../domain/entities/User.js";
import type { Email } from "../../../domain/value-objects/Email.js";

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(_id: string): Promise<User | null> {
    throw new Error("Not implemented");
  }

  async findByEmail(_email: Email): Promise<User | null> {
    throw new Error("Not implemented");
  }

  async save(_user: User): Promise<void> {
    throw new Error("Not implemented");
  }

  async delete(_id: string): Promise<void> {
    throw new Error("Not implemented");
  }
}
