import { useQuery } from '@tanstack/react-query'
import { jobSearchQueryOptions } from './query-options'
import type { JobSearchParams } from '@/lib/api/endpoints'

export function useJobSearch(params: JobSearchParams) {
  return useQuery(jobSearchQueryOptions(params))
}
