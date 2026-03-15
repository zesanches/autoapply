export const queryKeys = {
  dashboard: {
    stats: () => ['dashboard', 'stats'] as const,
    activity: () => ['dashboard', 'activity'] as const,
  },
  jobs: {
    search: (params: Record<string, unknown>) => ['jobs', 'search', params] as const,
  },
  applications: {
    list: (params?: Record<string, unknown>) => ['applications', 'list', params] as const,
  },
  credits: {
    balance: () => ['credits', 'balance'] as const,
  },
} as const
