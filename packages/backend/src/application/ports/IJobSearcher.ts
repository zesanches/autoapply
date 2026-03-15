import type { JobListing } from "../../domain/entities/JobListing.js";

export interface JobSearchFilters {
  query: string;
  platform: string;
  location?: string | undefined;
  remote?: boolean | undefined;
  salaryMin?: number | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
}

export interface JobSearchResult {
  items: JobListing[];
  total: number;
}

export interface IJobSearcher {
  search(filters: JobSearchFilters): Promise<JobSearchResult>;
}
