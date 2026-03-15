import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { dashboardApi } from '@/lib/api/endpoints'

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      const res = await dashboardApi.getStats()
      return res.data
    },
  })
}
