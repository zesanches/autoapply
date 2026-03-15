export interface SearchJobsInput {
  userId: string;
  query: string;
  platform: string;
  location?: string | undefined;
  remote?: boolean | undefined;
  salaryMin?: number | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
}

export interface SearchJobsOutput {
  items: Array<{
    id: string;
    externalId: string;
    platform: string;
    title: string;
    company: string;
    location: string | null;
    salary: string | null;
    url: string;
    postedAt: Date | null;
  }>;
  total: number;
  page: number;
  perPage: number;
}
