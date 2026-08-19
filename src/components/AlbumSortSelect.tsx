import type { AlbumSort } from '../api/client'
import { ICONS, Icon } from '../player/icons'
import { ALBUM_SORTS } from './albumSort'

export function AlbumSortSelect({
  value,
  reverse,
  onChange,
  onToggleReverse,
}: {
  value: AlbumSort
  reverse: boolean
  onChange: (sort: AlbumSort) => void
  onToggleReverse: () => void
}) {
  const libelle = ALBUM_SORTS.find((sort) => sort.value === value)?.label ?? value
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-500">
      Trier par
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as AlbumSort)}
        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
      >
        {ALBUM_SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
      <button
        onClick={onToggleReverse}
        title={reverse ? `${libelle} : ordre inversé` : `${libelle} : ordre habituel`}
        aria-label="Inverser l’ordre"
        aria-pressed={reverse}
        className={`rounded border px-2 py-1.5 ${
          reverse
            ? 'border-emerald-500/60 text-emerald-400'
            : 'border-neutral-700 text-neutral-400 hover:text-neutral-100'
        }`}
      >
        <Icon path={ICONS.reverse} className="h-4 w-4" />
      </button>
    </label>
  )
}
