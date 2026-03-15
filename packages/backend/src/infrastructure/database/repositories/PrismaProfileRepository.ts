import { Prisma, type PrismaClient } from "@prisma/client";
import type { IProfileRepository } from "../../../application/ports/IProfileRepository.js";
import { UserProfile } from "../../../domain/entities/UserProfile.js";

function jsonNullable(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export class PrismaProfileRepository implements IProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const row = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!row) return null;
    return UserProfile.create({
      id: row.id,
      userId: row.userId,
      fullName: row.fullName,
      phone: row.phone,
      location: row.location,
      linkedinUrl: row.linkedinUrl,
      portfolioUrl: row.portfolioUrl,
      resumeUrl: row.resumeUrl,
      resumeData: row.resumeData,
      skills: row.skills,
      experience: row.experience,
      education: row.education,
      preferences: row.preferences,
      isComplete: row.isComplete,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(profile: UserProfile): Promise<void> {
    const props = profile.toJSON();
    await this.prisma.userProfile.upsert({
      where: { userId: props.userId },
      create: {
        id: props.id,
        userId: props.userId,
        fullName: props.fullName,
        phone: props.phone,
        location: props.location,
        linkedinUrl: props.linkedinUrl,
        portfolioUrl: props.portfolioUrl,
        resumeUrl: props.resumeUrl,
        resumeData: jsonNullable(props.resumeData),
        skills: props.skills,
        experience: jsonNullable(props.experience),
        education: jsonNullable(props.education),
        preferences: jsonNullable(props.preferences),
        isComplete: props.isComplete,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        fullName: props.fullName,
        phone: props.phone,
        location: props.location,
        linkedinUrl: props.linkedinUrl,
        portfolioUrl: props.portfolioUrl,
        resumeUrl: props.resumeUrl,
        resumeData: jsonNullable(props.resumeData),
        skills: props.skills,
        experience: jsonNullable(props.experience),
        education: jsonNullable(props.education),
        preferences: jsonNullable(props.preferences),
        isComplete: props.isComplete,
        updatedAt: props.updatedAt,
      },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.userProfile.deleteMany({ where: { userId } });
  }
}
