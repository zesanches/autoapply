import type { JobListing } from "../../domain/entities/JobListing.js";
import type { UserProfile } from "../../domain/entities/UserProfile.js";

export interface ApplicationResult {
  success: boolean;
  formData?: Record<string, unknown> | undefined;
  error?: string | undefined;
}

export interface IJobApplier {
  apply(job: JobListing, profile: UserProfile): Promise<ApplicationResult>;
}
