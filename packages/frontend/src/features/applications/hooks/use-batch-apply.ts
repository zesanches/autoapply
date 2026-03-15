import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { jobsApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query/keys'

export function useBatchApply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobIds: string[]) => jobsApi.batchApply(jobIds),
    onSuccess: (res) => {
      toast.success(`${res.data.count} candidatura(s) enviada(s) para a fila!`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() })
    },
    onError: () => {
      toast.error('Erro ao enviar candidaturas. Tente novamente.')
    },
  })
}
