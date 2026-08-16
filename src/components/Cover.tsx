import { useState } from 'react'
import { coverUrl } from '../api/client'

type Props = {
  albumId: number
  hasCover: boolean
  size?: 'thumb' | 'full'
  className?: string
  alt?: string
}

/** Pochette avec repli graphique : en airgap, beaucoup d'albums n'en ont pas. */
export function Cover({ albumId, hasCover, size = 'thumb', className = '', alt = '' }: Props) {
  const [failed, setFailed] = useState(false)

  if (!hasCover || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-neutral-800 text-neutral-600 ${className}`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-1/3 w-1/3">
          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={coverUrl(albumId, size)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-neutral-800 object-cover ${className}`}
    />
  )
}
