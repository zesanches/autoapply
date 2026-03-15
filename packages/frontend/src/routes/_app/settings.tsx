import { createFileRoute } from '@tanstack/react-router'
import { ResumeUpload } from '@/features/profile/components/resume-upload'
import { useProfile } from '@/features/profile/hooks/use-profile'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { data: profileRes } = useProfile()
  const profile = profileRes?.data

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Configurações</h2>
        <p className="text-sm text-zinc-400 mt-1">Gerencie seu perfil e currículo.</p>
      </div>

      <ResumeUpload profile={profile} />

      {profile && (
        <div className="rounded-lg border border-zinc-800 bg-card p-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-100">Perfil</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-zinc-500">Nome</dt>
              <dd className="text-zinc-200">{profile.fullName}</dd>
            </div>
            {profile.phone && (
              <div className="flex gap-4">
                <dt className="w-24 shrink-0 text-zinc-500">Telefone</dt>
                <dd className="text-zinc-200">{profile.phone}</dd>
              </div>
            )}
            {profile.location && (
              <div className="flex gap-4">
                <dt className="w-24 shrink-0 text-zinc-500">Localização</dt>
                <dd className="text-zinc-200">{profile.location}</dd>
              </div>
            )}
            {profile.skills.length > 0 && (
              <div className="flex gap-4">
                <dt className="w-24 shrink-0 text-zinc-500">Skills</dt>
                <dd className="text-zinc-200">{profile.skills.join(', ')}</dd>
              </div>
            )}
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-zinc-500">Status</dt>
              <dd className={profile.isComplete ? 'text-green-400' : 'text-yellow-400'}>
                {profile.isComplete ? 'Completo' : 'Incompleto — faça upload do currículo'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
