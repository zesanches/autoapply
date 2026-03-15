import type { BrowserContext } from "playwright";
import { BasePlatformAdapter } from "./BasePlatformAdapter.js";
import type { JobSearchFilters, JobSearchResult } from "../../../application/ports/IJobSearcher.js";
import type { ApplicationResult } from "../../../application/ports/IJobApplier.js";
import type { JobListing } from "../../../domain/entities/JobListing.js";
import type { UserProfile } from "../../../domain/entities/UserProfile.js";

/**
 * Indeed platform adapter.
 *
 * NOTE: Stub implementation. Contract tests with HTML fixtures will drive
 * the real implementation (see docs/BACKEND-ARCHITECTURE.md).
 */
export class IndeedAdapter extends BasePlatformAdapter {
  protected readonly platformName = "indeed";

  constructor(context: BrowserContext) {
    super(context);
  }

  async search(_filters: JobSearchFilters): Promise<JobSearchResult> {
    throw new Error("IndeedAdapter.search not yet implemented");
  }

  async apply(
    _job: JobListing,
    _profile: UserProfile
  ): Promise<ApplicationResult> {
    throw new Error("IndeedAdapter.apply not yet implemented");
  }
}
