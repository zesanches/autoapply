import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { useState } from 'react'
import { jobSearchQueryOptions } from '@/features/jobs/hooks/query-options'
import { JobSearchForm } from '@/features/jobs/components/job-search-form'
import { JobCard } from '@/features/jobs/components/job-card'
import { BatchApplyBar } from '@/features/jobs/components/batch-apply-bar'
import { useJobSearch } from '@/features/jobs/hooks/use-job-search'
import { Skeleton } from '@/components/ui/skeleton'
import type { Platform } from '@autoapply/shared'

const searchSchema = z.object({
  q: z.string().default(''),
  platform: z.enum(['indeed', 'linkedin']).default('indeed'),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  page: z.number().int().positive().default(1),
})

export const Route = createFileRoute('/_app/jobs/')({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    deps.q
      ? context.queryClient.ensureQueryData(
          jobSearchQueryOptions({ q: deps.q, platform: deps.platform as Platform, location: deps.location, remote: deps.remote, page: deps.page })
        )
      : null,
  component: JobsPage,
})

function JobsPage() {
  const { q, platform, location, remote, page } = Route.useSearch()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data, isLoading } = useJobSearch({
    q,
    platform: platform as Platform,
    location,
    remote,
    page,
  })

  function toggleJob(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const jobs = data?.data ?? []

  return (
    <div className="space-y-6 pb-24">
      <JobSearchForm q={q} platform={platform as Platform} location={location} remote={remote} />

      {isLoading && q && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!isLoading && q && jobs.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-12">
          Nenhuma vaga encontrada para &quot;{q}&quot;.
        </p>
      )}

      {!q && (
        <p className="text-sm text-zinc-400 text-center py-12">
          Use o formulário acima para buscar vagas.
        </p>
      )}

      {jobs.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            {data?.meta?.total ?? jobs.length} vaga(s) encontrada(s)
          </p>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              selected={selectedIds.includes(job.id)}
              onToggle={toggleJob}
            />
          ))}
        </div>
      )}

      <BatchApplyBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
      />
    </div>
  )
}
