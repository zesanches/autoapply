export const QUEUES = {
  APPLICATIONS: "applications",
  SEARCH: "search",
} as const;

export const RATE_LIMITS = {
  APPLICATION_JOB_INTERVAL_MS: 45_000,
  BATCH_BASE_DELAY_MS: 60_000,
  BATCH_JITTER_MAX_MS: 30_000,
} as const;

export const BROWSER = {
  PAGE_TIMEOUT_MS: 30_000,
  NAVIGATION_TIMEOUT_MS: 15_000,
  MAX_RETRIES: 5,
} as const;

export const CREDITS = {
  FREE_PLAN_MONTHLY: 10,
  PRO_PLAN_MONTHLY: 100,
  PER_APPLICATION: 1,
} as const;

export const HTTP = {
  MAX_PAYLOAD_SIZE: "1mb",
  REQUEST_TIMEOUT_MS: 30_000,
} as const;
