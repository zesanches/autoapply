import { useRouterState } from '@tanstack/react-router'
import { LogOut, Coins } from 'lucide-react'
import { signOut } from '@/features/auth/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/jobs': 'Buscar Vagas',
  '/applications': 'Candidaturas',
}

export function Topbar() {
  const location = useRouterState({ select: (s) => s.location })
  const title = routeTitles[location.pathname] ?? 'AutoApply'
  const { data: stats } = useDashboardStats()

  async function handleSignOut() {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-card px-6">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <div className="flex items-center gap-3">
        {stats && (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Coins className="h-3 w-3" />
            {stats.creditsAvailable} créditos
          </Badge>
        )}
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
