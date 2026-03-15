import { useRef } from 'react'
import { Upload, FileText, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useUploadResume } from '../hooks/use-profile'
import type { UserProfile } from '@/lib/api/endpoints'

interface ResumeUploadProps {
  profile: UserProfile | undefined
}

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt'

export function ResumeUpload({ profile }: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadResume()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    upload.mutate(file, {
      onSuccess: () => {
        toast.success('Currículo carregado e analisado com sucesso!')
      },
      onError: () => {
        toast.error('Erro ao carregar currículo. Verifique o formato do arquivo.')
      },
    })

    // Reset input so the same file can be re-uploaded
    e.target.value = ''
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-card p-6">
      <h2 className="mb-1 text-base font-semibold text-zinc-100">Currículo</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Faça upload do seu currículo. O sistema irá extrair automaticamente suas
        informações para preencher formulários de candidatura.
      </p>

      {profile?.resumeUrl ? (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3">
          <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-200">Currículo carregado</p>
            <p className="text-xs text-zinc-500">{profile.resumeUrl.split('/').pop()}</p>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-dashed border-zinc-700 px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
          <p className="text-sm text-zinc-500">Nenhum currículo carregado</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="flex items-center gap-2"
      >
        {upload.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {upload.isPending ? 'Analisando...' : profile?.resumeUrl ? 'Substituir currículo' : 'Carregar currículo'}
      </Button>

      <p className="mt-2 text-xs text-zinc-500">
        Formatos aceitos: PDF, DOCX, DOC, TXT (máx. 10MB)
      </p>
    </div>
  )
}
