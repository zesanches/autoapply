import { MapPin, Building2, ExternalLink, Zap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { JobListing } from '@/lib/api/endpoints'
import { useProfile } from '@/features/profile/hooks/use-profile'
import { useSingleApply } from '../hooks/use-single-apply'

interface JobCardProps {
  job: JobListing
  selected: boolean
  onToggle: (id: string) => void
}

export function JobCard({ job, selected, onToggle }: JobCardProps) {
  const { data: profileRes } = useProfile()
  const apply = useSingleApply()

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!profileRes?.data?.resumeUrl) {
      toast.warning('Currículo não encontrado', {
        description: 'Vá em Configurações e faça upload do seu currículo antes de aplicar.',
        action: { label: 'Configurações', onClick: () => { window.location.href = '/settings' } },
      })
      return
    }

    apply.mutate(job.id)
  }

  const isApplied = apply.isSuccess
  const isLoading = apply.isPending

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:border-zinc-700',
        selected && 'border-primary ring-1 ring-primary'
      )}
      onClick={() => onToggle(job.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(job.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-900 accent-primary"
            />
            <div className="min-w-0">
              <h3 className="font-medium text-zinc-100 truncate">{job.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-zinc-400">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {job.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {job.remote && (
              <Badge variant="secondary" className="text-xs">
                Remoto
              </Badge>
            )}
            <Badge variant="outline" className="text-xs capitalize">
              {job.platform}
            </Badge>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-zinc-500 hover:text-zinc-200"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <Button
              size="sm"
              variant={isApplied ? 'secondary' : 'default'}
              className="h-7 px-2 text-xs"
              onClick={handleApply}
              disabled={isLoading || isApplied}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              <span className="ml-1">{isApplied ? 'Na fila' : 'Aplicar'}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
