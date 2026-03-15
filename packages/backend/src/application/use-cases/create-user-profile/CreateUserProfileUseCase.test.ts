import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateUserProfileUseCase } from "./CreateUserProfileUseCase.js";
import type { IProfileRepository } from "../../ports/IProfileRepository.js";

describe("CreateUserProfileUseCase", () => {
  let profileRepository: IProfileRepository;
  let useCase: CreateUserProfileUseCase;

  beforeEach(() => {
    profileRepository = {
      findByUserId: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new CreateUserProfileUseCase(profileRepository);
  });

  it("creates a new profile successfully", async () => {
    const result = await useCase.execute({
      userId: "user-1",
      fullName: "Jane Doe",
      skills: ["React", "TypeScript"],
    });

    expect(profileRepository.save).toHaveBeenCalledOnce();
    expect(result.fullName).toBe("Jane Doe");
    expect(result.userId).toBe("user-1");
    expect(result.isComplete).toBe(false);
  });

  it("throws when profile already exists", async () => {
    vi.mocked(profileRepository.findByUserId).mockResolvedValueOnce({
      id: "existing",
    } as never);

    await expect(
      useCase.execute({ userId: "user-1", fullName: "Jane Doe" })
    ).rejects.toThrow("Profile already exists for user: user-1");
  });

  it("initializes profile as incomplete", async () => {
    const result = await useCase.execute({
      userId: "user-1",
      fullName: "Jane Doe",
    });

    expect(result.isComplete).toBe(false);
  });

  it("defaults skills to empty array when not provided", async () => {
    await useCase.execute({ userId: "user-1", fullName: "Jane Doe" });

    const savedProfile = vi.mocked(profileRepository.save).mock.calls[0]?.[0];
    expect(savedProfile?.skills).toEqual([]);
  });
});
