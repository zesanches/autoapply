import { createFileRoute, isRedirect, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context }) => {
    try {
      const session = await context.auth.getSession()
      if (session?.data?.session) {
        throw redirect({ to: '/dashboard' })
      }
    } catch (err) {
      if (isRedirect(err)) throw err
      // Network error → stay on auth page
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-100">AutoApply</h1>
          <p className="mt-2 text-sm text-zinc-400">Candidaturas automáticas com IA</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
