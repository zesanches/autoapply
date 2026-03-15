export const QUEUE_NAMES = {
  APPLICATIONS: "applications",
  SEARCH: "search",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface ApplicationJobData {
  userId: string;
  jobId: string;
  applicationId?: string | undefined;
  batchId?: string | undefined;
}

export interface SearchJobData {
  userId: string;
  query: string;
  platform: string;
  location?: string | undefined;
}
