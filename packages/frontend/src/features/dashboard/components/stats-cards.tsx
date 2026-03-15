import { FileText, CheckCircle, XCircle, Clock, Coins, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardStats } from '../hooks/use-dashboard-stats'

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
        <Icon className="h-4 w-4 text-zinc-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-zinc-100">{value}</div>
        {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  )
}

export function StatsCards() {
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total de Candidaturas"
        value={stats.totalApplications}
        icon={FileText}
      />
      <StatCard
        title="Enviadas"
        value={stats.submitted}
        icon={CheckCircle}
        description="Com sucesso"
      />
      <StatCard
        title="Falhas"
        value={stats.failed}
        icon={XCircle}
        description="Após 5 tentativas"
      />
      <StatCard
        title="Pendentes"
        value={stats.pending}
        icon={Clock}
        description="Na fila ou aplicando"
      />
      <StatCard
        title="Créditos Disponíveis"
        value={stats.creditsAvailable}
        icon={Coins}
      />
      <StatCard
        title="Créditos Usados"
        value={stats.creditsUsed}
        icon={TrendingUp}
        description="Total consumido"
      />
    </div>
  )
}
