import { createFileRoute } from '@tanstack/react-router'
import { ApplicationsTable } from '@/features/applications/components/applications-table'

export const Route = createFileRoute('/_app/applications/')({
  component: ApplicationsPage,
})

function ApplicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Candidaturas</h2>
        <p className="text-sm text-zinc-400 mt-1">Histórico de todas as suas candidaturas.</p>
      </div>
      <ApplicationsTable />
    </div>
  )
}
