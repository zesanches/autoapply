import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { IProfileRepository } from "../../ports/IProfileRepository.js";
import type { IResumeParser, ParsedResume } from "../../ports/IResumeParser.js";
import { UserProfile } from "../../../domain/entities/UserProfile.js";

export interface UploadResumeInput {
  userId: string;
  fileBuffer: Buffer;
  mimeType: string;
  originalFilename: string;
  uploadDir: string;
}

export interface UploadResumeOutput {
  resumeUrl: string;
  resumeData: ParsedResume;
  isComplete: boolean;
}

export class UploadResumeUseCase {
  constructor(
    private readonly profileRepository: IProfileRepository,
    private readonly resumeParser: IResumeParser
  ) {}

  async execute(input: UploadResumeInput): Promise<UploadResumeOutput> {
    const { userId, fileBuffer, mimeType, originalFilename, uploadDir } = input;

    // Parse resume
    const resumeData = await this.resumeParser.parse(fileBuffer, mimeType);

    // Persist file to local storage
    await mkdir(uploadDir, { recursive: true });
    const ext = extname(originalFilename) || ".bin";
    const filename = `${userId}-${randomUUID()}${ext}`;
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, fileBuffer);
    const resumeUrl = `/uploads/${filename}`;

    // Upsert profile
    const existing = await this.profileRepository.findByUserId(userId);

    const profileProps = {
      id: existing?.id ?? `profile-${userId}`,
      userId,
      fullName: existing?.fullName && existing.fullName.trim() ? existing.fullName : resumeData.fullName,
      phone: resumeData.phone ?? existing?.toJSON().phone ?? null,
      location: resumeData.location ?? existing?.toJSON().location ?? null,
      linkedinUrl: existing?.toJSON().linkedinUrl ?? null,
      portfolioUrl: existing?.toJSON().portfolioUrl ?? null,
      resumeUrl,
      resumeData,
      skills: resumeData.skills.length > 0 ? resumeData.skills : existing?.skills ?? [],
      experience: resumeData.experience,
      education: resumeData.education,
      preferences: existing?.toJSON().preferences ?? null,
      isComplete: false,
      createdAt: existing?.toJSON().createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    const profile = UserProfile.create(profileProps);
    const isComplete = profile.checkCompleteness();
    const finalProfile = UserProfile.create({ ...profileProps, isComplete });

    await this.profileRepository.save(finalProfile);

    return { resumeUrl, resumeData, isComplete };
  }
}
