import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { queryClient } from '@/lib/query/client'
import { authClient } from '@/features/auth/lib/auth-client'

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: authClient,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
