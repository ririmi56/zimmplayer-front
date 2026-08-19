import { ICONS, Icon } from '../player/icons'
import { useLikes } from '../state/likes'

/**
 * Le coeur, partout ou un titre apparait.
 *
 * Contour quand le titre n'est pas aime, plein quand il l'est. Le composant
 * lit l'ensemble des likes plutot que de recevoir un booleen : ainsi il se
 * pose n'importe ou sans que l'appelant ait rien a charger.
 */
export function LikeButton({
  trackId,
  className = '',
  size = 'h-4 w-4',
}: {
  trackId: number
  className?: string
  /** Visible en permanence quand il est aime : sinon on ne le verrait jamais. */
  size?: string
}) {
  const { likes, basculer } = useLikes()
  const aime = likes.has(trackId)

  return (
    <button
      onClick={(event) => {
        // Les lignes de titre lancent la lecture au clic : sans ceci, aimer un
        // titre le jouerait aussi.
        event.stopPropagation()
        basculer(trackId)
      }}
      title={aime ? 'Ne plus aimer' : 'Aimer'}
      aria-label={aime ? 'Ne plus aimer ce titre' : 'Aimer ce titre'}
      aria-pressed={aime}
      className={`shrink-0 ${aime ? 'text-rose-400 hover:text-rose-300' : 'text-neutral-600 hover:text-rose-400'} ${className}`}
    >
      <Icon path={ICONS.heart} filled={aime} className={size} />
    </button>
  )
}
