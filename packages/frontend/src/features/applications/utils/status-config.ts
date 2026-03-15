import type { ApplicationStatus } from '@autoapply/shared'

export const statusConfig: Record<ApplicationStatus, { label: string; className: string }> = {
  queued:    { label: 'Na fila',    className: 'bg-zinc-700 text-zinc-200' },
  applying:  { label: 'Aplicando',  className: 'bg-blue-900 text-blue-200' },
  submitted: { label: 'Enviado',    className: 'bg-emerald-900 text-emerald-200' },
  failed:    { label: 'Falhou',     className: 'bg-red-900 text-red-200' },
  retrying:  { label: 'Tentando',   className: 'bg-amber-900 text-amber-200' },
  exhausted: { label: 'Esgotado',   className: 'bg-red-950 text-red-300' },
}
