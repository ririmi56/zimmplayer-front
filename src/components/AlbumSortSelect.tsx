import type { AlbumSort } from '../api/client'
import { ALBUM_SORTS } from './albumSort'

export function AlbumSortSelect({
  value,
  onChange,
}: {
  value: AlbumSort
  onChange: (sort: AlbumSort) => void
}) {
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
    </label>
  )
}
