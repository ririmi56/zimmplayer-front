import { ICONS, Icon } from '../player/icons'
import { useFavorites } from '../state/favorites'

/**
 * L'etoile, partout ou un album apparait.
 *
 * Contour quand l'album n'est pas en favori, pleine quand il l'est. Comme le
 * coeur des titres, le composant lit l'ensemble des favoris plutot que de
 * recevoir un booleen : il se pose n'importe ou sans que l'appelant ait rien
 * a charger.
 */
export function FavoriteButton({
  albumId,
  albumTitle,
  className = '',
  size = 'h-4 w-4',
  discret = false,
}: {
  albumId: number
  albumTitle: string
  className?: string
  size?: string
  /**
   * Sur une vignette : efface tant qu'on ne survole pas, comme le menu kebab.
   * Une etoile grise permanente sur soixante pochettes serait du bruit — mais
   * une etoile PLEINE reste toujours visible, sinon on ne verrait jamais
   * d'un coup d'oeil quels albums sont en favori.
   */
  discret?: boolean
}) {
  const { favoris, basculer } = useFavorites()
  const enFavori = favoris.has(albumId)
  const visibilite =
    discret && !enFavori ? 'opacity-0 focus:opacity-100 group-hover:opacity-100' : ''

  return (
    <button
      onClick={(event) => {
        // La vignette entiere est un lien vers l'album : sans ceci, mettre en
        // favori y naviguerait aussitot.
        event.preventDefault()
        event.stopPropagation()
        basculer(albumId)
      }}
      title={enFavori ? 'Retirer des favoris' : 'Mettre en favori'}
      aria-label={
        enFavori ? `Retirer ${albumTitle} des favoris` : `Mettre ${albumTitle} en favori`
      }
      aria-pressed={enFavori}
      className={`shrink-0 transition ${
        enFavori ? 'text-amber-300 hover:text-amber-200' : 'text-neutral-600 hover:text-amber-300'
      } ${visibilite} ${className}`}
    >
      <Icon path={ICONS.star} filled={enFavori} className={size} />
    </button>
  )
}
