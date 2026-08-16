import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type Track } from '../api/client'

type Props = {
  track: Track
  onClose: () => void
}

type Field = 'title' | 'track_no' | 'disc_no'

const FIELDS: { name: Field; label: string; type: 'text' | 'number' }[] = [
  { name: 'title', label: 'Titre', type: 'text' },
  { name: 'track_no', label: 'N° de piste', type: 'number' },
  { name: 'disc_no', label: 'N° de disque', type: 'number' },
]

/**
 * Correction manuelle des metadonnees d'une piste.
 *
 * Rien n'est ecrit dans le bucket : la correction est stockee a part et
 * reappliquee apres chaque scan. La retirer fait donc reapparaitre la valeur
 * lue dans le fichier.
 */
export function TrackEditor({ track, onClose }: Props) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<Field, string>>({
    title: track.title,
    track_no: track.track_no?.toString() ?? '',
    disc_no: track.disc_no?.toString() ?? '',
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateTrack(track.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', track.album_id] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      onClose()
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    save.mutate({
      title: values.title.trim() || null,
      track_no: values.track_no === '' ? null : Number(values.track_no),
      disc_no: values.disc_no === '' ? null : Number(values.disc_no),
    })
  }

  const resetAll = () => save.mutate({ title: null, track_no: null, disc_no: null })
  const corrected = Object.keys(track.overrides ?? {})

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Corriger les métadonnées"
        className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">Corriger les métadonnées</h2>
        <p className="mb-5 text-xs text-neutral-500">
          La correction est enregistrée en base et réappliquée après chaque scan. Le fichier
          dans le bucket n'est jamais modifié.
        </p>

        <div className="space-y-4">
          {FIELDS.map((field) => (
            <label key={field.name} className="block">
              <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-400">
                {field.label}
                {corrected.includes(field.name) && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] normal-case text-amber-300">
                    corrigé
                  </span>
                )}
              </span>
              <input
                type={field.type}
                value={values[field.name]}
                onChange={(e) =>
                  setValues((previous) => ({ ...previous, [field.name]: e.target.value }))
                }
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              />
            </label>
          ))}
        </div>

        {save.error && (
          <p className="mt-4 text-sm text-red-400">{(save.error as Error).message}</p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetAll}
            disabled={corrected.length === 0 || save.isPending}
            className="text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Rétablir les valeurs des tags
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
