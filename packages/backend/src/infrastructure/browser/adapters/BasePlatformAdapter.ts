import type { BrowserContext } from "playwright";
import type { IJobSearcher, JobSearchFilters, JobSearchResult } from "../../../application/ports/IJobSearcher.js";
import type { IJobApplier, ApplicationResult } from "../../../application/ports/IJobApplier.js";
import type { JobListing } from "../../../domain/entities/JobListing.js";
import type { UserProfile } from "../../../domain/entities/UserProfile.js";

export abstract class BasePlatformAdapter implements IJobSearcher, IJobApplier {
  constructor(protected readonly context: BrowserContext) {}

  abstract search(filters: JobSearchFilters): Promise<JobSearchResult>;
  abstract apply(job: JobListing, profile: UserProfile): Promise<ApplicationResult>;

  protected abstract get platformName(): string;

  protected async navigateTo(url: string): Promise<void> {
    const page = await this.context.newPage();
    try {
      await page.goto(url, { timeout: 15_000 });
    } finally {
      await page.close();
    }
  }
}
