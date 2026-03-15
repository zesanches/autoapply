import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Search, FileText } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Vagas', icon: Search },
  { to: '/applications', label: 'Candidaturas', icon: FileText },
] as const

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-zinc-800 bg-card px-3 py-4">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-bold text-zinc-100">AutoApply</h1>
      </div>
      <nav className="flex flex-col gap-1">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100'
            )}
            activeProps={{ className: 'bg-zinc-800 text-zinc-100' }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
