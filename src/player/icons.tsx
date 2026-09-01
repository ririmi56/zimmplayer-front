/**
 * Traces des icones, dans un repere de 24x24.
 *
 * **Invariant : l'encre de chaque icone est centree sur (12, 12).** Ce n'est
 * pas de la coquetterie — le coeur, l'ajout en playlist et l'ajout en file se
 * suivent dans la meme rangee sur chaque ligne de titre, et un centre qui
 * differe de quelques dixiemes se voit tout de suite a 16 px, surtout dans des
 * pastilles rondes.
 *
 * Mesure du 2026-09-01, avant correction : le coeur etait centre sur
 * (12,13 ; 12,71), l'ajout en playlist sur (13 ; 12), l'ajout en file sur
 * (12,75 ; 13,45). Trois centres differents pour trois icones voisines.
 *
 * Pour verifier apres avoir touche a un trace, dans une page vide :
 *
 *     const b = path.getBBox()
 *     // b.x + b.width / 2  et  b.y + b.height / 2  doivent valoir 12
 */
export const ICONS = {
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M9 5v14M15 5v14',
  previous: 'M18 6v12L9 12zM6 5.5v13',
  next: 'M6 6v12l9-6zM18 5.5v13',
  shuffle: 'M16 4h4v4M4 20 20 4M16 20h4v-4M4 4l5 5M15 15l5 5',
  repeat: 'M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
  volume: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7',
  mute: 'M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
  lyrics: 'M4 6h16M4 10h16M4 14h10M4 18h7',
  queue: 'M4 7h11M4 12h11M4 17h7M17 12v7M17 12l4-2v7',
  // Les deux ajouts doivent se distinguer d'un coup d'oeil a 16 px : d'ou un
  // marque-page pour la playlist, qui se garde, et le triangle de lecture pour
  // la file, qui dit « a jouer ensuite ». Trois traits + « + » pour les deux,
  // comme avant, les rendait indiscernables.
  playlistAdd: 'M5 3.5h7a1 1 0 011 1v12.5l-4.5-3.1L4 17V4.5a1 1 0 011-1zM17 14.5v6M14 17.5h6',
  queueAdd: 'M3.25 4.55h13M3.25 9.55h13M3.25 14.55h8M15.25 13.05l5.5 3.2-5.5 3.2z',
  // Contour quand le titre n'est pas aime, rempli quand il l'est : c'est le
  // meme trace, `Icon` s'occupe du remplissage.
  heart: 'M11.87 19.79 4.07 12.19a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 1 1 6.5 6.5z',
  // L'etoile des albums, a ne pas confondre avec le coeur des titres : deux
  // notions distinctes, deux formes franchement differentes.
  // Centree sur (12 ; 11,8), soit 0,2 unite au-dessus du centre — un huitieme
  // de pixel a 16 px. Laissee telle quelle : elle se pose seule sur une
  // pochette, jamais a cote d'une autre icone.
  star: 'M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.8z',
  headphones: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v6H4zM17 14h3v6h-3z',
  // Deux fleches opposees : le bouton retourne le sens du tri en cours.
  kebab: 'M12 5.5h.01M12 12h.01M12 18.5h.01',
  reverse: 'M7 20V4M7 4 4 7.5M7 4l3 3.5M17 4v16M17 20l-3-3.5M17 20l3-3.5',
  dragHandle: 'M5 9h14M5 15h14',
  edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
}

export function Icon({
  path,
  filled = false,
  className = 'h-5 w-5',
}: {
  path: string
  filled?: boolean
  /** Taille par defaut adaptee a la barre de lecture ; a reduire ailleurs. */
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  )
}
