import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query/keys'

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => profileApi.get(),
    retry: false,
  })
}

export function useUploadResume() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => profileApi.uploadResume(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() })
    },
  })
}
