import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { jobsApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query/keys'

export function useSingleApply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => jobsApi.apply(jobId),
    onSuccess: () => {
      toast.success('Candidatura enviada para a fila!')
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('PROFILE_INCOMPLETE')) {
        toast.error('Configure seu perfil primeiro', {
          description: 'Vá em Configurações e faça upload do seu currículo.',
          action: { label: 'Configurações', onClick: () => { window.location.href = '/settings' } },
        })
      } else if (message.includes('INSUFFICIENT_CREDITS')) {
        toast.error('Créditos insuficientes para enviar candidatura.')
      } else {
        toast.error('Erro ao enviar candidatura. Tente novamente.')
      }
    },
  })
}
