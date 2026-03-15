import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useBatchApply } from '../hooks/use-batch-apply'

interface BatchApplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobIds: string[]
  onSuccess: () => void
}

export function BatchApplyDialog({ open, onOpenChange, jobIds, onSuccess }: BatchApplyDialogProps) {
  const { mutate, isPending } = useBatchApply()

  function handleConfirm() {
    mutate(jobIds, {
      onSuccess: () => {
        onOpenChange(false)
        onSuccess()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar candidaturas</DialogTitle>
          <DialogDescription>
            Você está prestes a se candidatar a <strong className="text-zinc-100">{jobIds.length}</strong> vaga(s).
            Cada candidatura consumirá 1 crédito. As candidaturas serão processadas em segundo plano.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Enviando...' : `Confirmar ${jobIds.length} candidatura(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
