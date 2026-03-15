import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Platform } from '@autoapply/shared'

interface JobSearchFormProps {
  q: string
  platform: Platform
  location?: string
  remote?: boolean
}

export function JobSearchForm({ q, platform, location, remote }: JobSearchFormProps) {
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    void navigate({
      to: '/jobs',
      search: {
        q: (fd.get('q') as string) || '',
        platform: (fd.get('platform') as Platform) || 'indeed',
        location: (fd.get('location') as string) || undefined,
        remote: fd.get('remote') === 'on' ? true : undefined,
        page: 1,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-48 space-y-1.5">
        <Label htmlFor="q">Buscar vagas</Label>
        <Input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="ex: frontend developer"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="platform">Plataforma</Label>
        <select
          id="platform"
          name="platform"
          defaultValue={platform}
          className="flex h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <option value="indeed">Indeed</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Localização</Label>
        <Input
          id="location"
          name="location"
          defaultValue={location}
          placeholder="ex: São Paulo"
          className="w-40"
        />
      </div>
      <div className="flex items-center gap-2 pb-1">
        <input
          id="remote"
          name="remote"
          type="checkbox"
          defaultChecked={remote}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-primary"
        />
        <Label htmlFor="remote">Remoto</Label>
      </div>
      <Button type="submit">
        <Search className="h-4 w-4" />
        Buscar
      </Button>
    </form>
  )
}
