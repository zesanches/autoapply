import type { IProfileRepository } from "../../ports/IProfileRepository.js";
import { UserProfile } from "../../../domain/entities/UserProfile.js";

export interface CreateUserProfileInput {
  userId: string;
  fullName: string;
  phone?: string | undefined;
  location?: string | undefined;
  linkedinUrl?: string | undefined;
  portfolioUrl?: string | undefined;
  skills?: string[] | undefined;
}

export interface CreateUserProfileOutput {
  id: string;
  userId: string;
  fullName: string;
  isComplete: boolean;
}

export class CreateUserProfileUseCase {
  constructor(private readonly profileRepository: IProfileRepository) {}

  async execute(input: CreateUserProfileInput): Promise<CreateUserProfileOutput> {
    const existing = await this.profileRepository.findByUserId(input.userId);
    if (existing) {
      throw new Error(`Profile already exists for user: ${input.userId}`);
    }

    const profile = UserProfile.create({
      id: `profile-${input.userId}`,
      userId: input.userId,
      fullName: input.fullName,
      phone: input.phone ?? null,
      location: input.location ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      portfolioUrl: null,
      resumeUrl: null,
      resumeData: null,
      skills: input.skills ?? [],
      experience: null,
      education: null,
      preferences: null,
      isComplete: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.profileRepository.save(profile);

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      isComplete: profile.isComplete,
    };
  }
}
