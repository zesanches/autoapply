import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { applicationsApi } from '@/lib/api/endpoints'
import type { ApplicationStatus } from '@autoapply/shared'

export function useApplications(params?: { page?: number; perPage?: number; status?: ApplicationStatus }) {
  return useQuery({
    queryKey: queryKeys.applications.list(params as Record<string, unknown> | undefined),
    queryFn: async () => {
      const res = await applicationsApi.list(params)
      return res
    },
  })
}
