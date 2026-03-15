import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-zinc-900 border-zinc-700 text-zinc-100',
          description: 'text-zinc-400',
          actionButton: 'bg-primary text-white',
          cancelButton: 'bg-zinc-800 text-zinc-300',
        },
      }}
    />
  )
}
