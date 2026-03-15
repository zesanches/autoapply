import type { BrowserContext } from "playwright";
import { BasePlatformAdapter } from "./BasePlatformAdapter.js";
import type { JobSearchFilters, JobSearchResult } from "../../../application/ports/IJobSearcher.js";
import type { ApplicationResult } from "../../../application/ports/IJobApplier.js";
import type { JobListing } from "../../../domain/entities/JobListing.js";
import type { UserProfile } from "../../../domain/entities/UserProfile.js";

/**
 * LinkedIn platform adapter.
 *
 * NOTE: Stub implementation. Contract tests with HTML fixtures will drive
 * the real implementation.
 */
export class LinkedInAdapter extends BasePlatformAdapter {
  protected readonly platformName = "linkedin";

  constructor(context: BrowserContext) {
    super(context);
  }

  async search(_filters: JobSearchFilters): Promise<JobSearchResult> {
    throw new Error("LinkedInAdapter.search not yet implemented");
  }

  async apply(
    _job: JobListing,
    _profile: UserProfile
  ): Promise<ApplicationResult> {
    throw new Error("LinkedInAdapter.apply not yet implemented");
  }
}
