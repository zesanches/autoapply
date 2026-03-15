import { createFileRoute, isRedirect, Outlet, redirect } from '@tanstack/react-router'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    try {
      const session = await context.auth.getSession()
      if (!session?.data?.session) {
        throw redirect({ to: '/login' })
      }
    } catch (err) {
      if (isRedirect(err)) throw err
      // Network error (backend down) → treat as unauthenticated
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
