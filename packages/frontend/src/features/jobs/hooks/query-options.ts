import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { jobsApi, type JobSearchParams } from '@/lib/api/endpoints'

export function jobSearchQueryOptions(params: JobSearchParams) {
  return queryOptions({
    queryKey: queryKeys.jobs.search(params as unknown as Record<string, unknown>),
    queryFn: async () => {
      const res = await jobsApi.search(params)
      return res
    },
    enabled: Boolean(params.q),
  })
}
