import type { User } from "../../domain/entities/User.js";
import type { Email } from "../../domain/value-objects/Email.js";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
