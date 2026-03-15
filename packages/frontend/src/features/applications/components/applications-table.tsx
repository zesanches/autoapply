import { ExternalLink } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplicationStatusBadge } from './application-status-badge'
import { useApplications } from '../hooks/use-applications'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function ApplicationsTable() {
  const { data, isLoading } = useApplications({ perPage: 50 })

  const applications = data?.data ?? []

  return (
    <div className="rounded-lg border border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vaga</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
          {!isLoading && applications.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-zinc-400 py-12">
                Nenhuma candidatura ainda. Busque vagas e candidate-se!
              </TableCell>
            </TableRow>
          )}
          {applications.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium text-zinc-200 max-w-48 truncate">
                {app.job.title}
              </TableCell>
              <TableCell className="text-zinc-400">{app.job.company}</TableCell>
              <TableCell className="text-zinc-400 capitalize">{app.job.platform}</TableCell>
              <TableCell>
                <ApplicationStatusBadge status={app.status} />
              </TableCell>
              <TableCell className="text-zinc-400 text-xs">
                {formatDate(app.createdAt)}
              </TableCell>
              <TableCell>
                <a
                  href={app.job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
