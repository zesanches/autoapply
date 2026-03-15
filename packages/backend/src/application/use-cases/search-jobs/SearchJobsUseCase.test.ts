import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchJobsUseCase } from "./SearchJobsUseCase.js";
import type { IJobSearcher, JobSearchResult } from "../../ports/IJobSearcher.js";
import { JobListing } from "../../../domain/entities/JobListing.js";
import { JobPlatform } from "../../../domain/value-objects/JobPlatform.js";

function makeJobListing(overrides: Partial<ConstructorParameters<typeof JobListing>[0]> = {}): JobListing {
  return JobListing.create({
    id: "job-1",
    externalId: "ext-1",
    platform: JobPlatform.create("indeed"),
    title: "Software Engineer",
    company: "Acme Corp",
    location: "Remote",
    salary: "R$8.000-R$12.000",
    description: null,
    url: "https://indeed.com/job/1",
    postedAt: new Date("2026-01-01"),
    scrapedAt: new Date(),
    metadata: null,
    isActive: true,
    ...overrides,
  });
}

describe("SearchJobsUseCase", () => {
  let jobSearcher: IJobSearcher;
  let useCase: SearchJobsUseCase;

  beforeEach(() => {
    jobSearcher = {
      search: vi.fn(),
    };
    useCase = new SearchJobsUseCase(jobSearcher);
  });

  it("delegates to jobSearcher with correct filters", async () => {
    const mockResult: JobSearchResult = {
      items: [makeJobListing()],
      total: 1,
    };
    vi.mocked(jobSearcher.search).mockResolvedValueOnce(mockResult);

    await useCase.execute({
      userId: "user-1",
      query: "software engineer",
      platform: "indeed",
      location: "São Paulo",
      remote: true,
    });

    expect(jobSearcher.search).toHaveBeenCalledWith({
      query: "software engineer",
      platform: "indeed",
      location: "São Paulo",
      remote: true,
      salaryMin: undefined,
      page: 1,
      perPage: 20,
    });
  });

  it("returns mapped job listings", async () => {
    const job = makeJobListing();
    vi.mocked(jobSearcher.search).mockResolvedValueOnce({ items: [job], total: 1 });

    const result = await useCase.execute({
      userId: "user-1",
      query: "engineer",
      platform: "indeed",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "job-1",
      platform: "indeed",
      title: "Software Engineer",
      company: "Acme Corp",
    });
    expect(result.total).toBe(1);
  });

  it("uses default pagination when not provided", async () => {
    vi.mocked(jobSearcher.search).mockResolvedValueOnce({ items: [], total: 0 });

    const result = await useCase.execute({
      userId: "user-1",
      query: "engineer",
      platform: "indeed",
    });

    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it("respects custom pagination", async () => {
    vi.mocked(jobSearcher.search).mockResolvedValueOnce({ items: [], total: 0 });

    const result = await useCase.execute({
      userId: "user-1",
      query: "engineer",
      platform: "indeed",
      page: 2,
      perPage: 10,
    });

    expect(result.page).toBe(2);
    expect(result.perPage).toBe(10);
  });

  it("propagates errors from jobSearcher", async () => {
    vi.mocked(jobSearcher.search).mockRejectedValueOnce(
      new Error("Platform unreachable")
    );

    await expect(
      useCase.execute({ userId: "user-1", query: "engineer", platform: "indeed" })
    ).rejects.toThrow("Platform unreachable");
  });
});
