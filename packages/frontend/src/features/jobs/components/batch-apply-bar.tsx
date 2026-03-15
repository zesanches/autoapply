import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BatchApplyDialog } from '@/features/applications/components/batch-apply-dialog'

interface BatchApplyBarProps {
  selectedIds: string[]
  onClearSelection: () => void
}

export function BatchApplyBar({ selectedIds, onClearSelection }: BatchApplyBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  if (selectedIds.length === 0) return null

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 shadow-xl">
        <span className="text-sm text-zinc-200">
          <span className="font-semibold text-zinc-100">{selectedIds.length}</span> vaga(s) selecionada(s)
        </span>
        <Button variant="outline" size="sm" onClick={onClearSelection}>
          Limpar
        </Button>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          Candidatar-se
        </Button>
      </div>
      <BatchApplyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobIds={selectedIds}
        onSuccess={onClearSelection}
      />
    </>
  )
}
