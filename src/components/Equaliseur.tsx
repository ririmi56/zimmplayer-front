/**
 * Trois barres qui dansent : « ça joue ici ».
 *
 * Un point coloré dirait la même chose, mais se confondrait avec les pastilles
 * d'état qu'on voit partout ailleurs. Le mouvement, lui, ne se confond avec
 * rien — et s'arrête de lui-même quand la lecture s'arrête, puisque le
 * composant disparaît.
 *
 * `aria-hidden` : le texte à côté dit déjà « en lecture », et une image
 * décorative annoncée deux fois gêne plus qu'elle n'aide.
 */
export function Equaliseur({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-3 items-end gap-[2px] ${className}`}
    >
      {[0, 1, 2].map((barre) => (
        <span
          key={barre}
          // Décalage par barre : sans lui, les trois montent ensemble et le
          // motif ressemble à un clignotement, pas à un égaliseur.
          style={{ animationDelay: `${barre * 180}ms` }}
          className={`egaliseur-barre w-[3px] rounded-sm bg-current ${
            // Hauteurs differentes : trois barres identiques paraissent
            // mecaniques, meme animees en decale.
            ['h-2', 'h-3', 'h-2.5'][barre]
          }`}
        />
      ))}
    </span>
  )
}
