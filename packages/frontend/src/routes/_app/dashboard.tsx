import { createFileRoute } from '@tanstack/react-router'
import { StatsCards } from '@/features/dashboard/components/stats-cards'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Visão Geral</h2>
        <p className="text-sm text-zinc-400 mt-1">Acompanhe suas candidaturas em tempo real.</p>
      </div>
      <StatsCards />
    </div>
  )
}
