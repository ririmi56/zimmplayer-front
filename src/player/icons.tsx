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
  playlistAdd: 'M6 3.5h7a1 1 0 011 1v12.5l-4.5-3.1L5 17V4.5a1 1 0 011-1zM18 14.5v6M15 17.5h6',
  queueAdd: 'M4 6h13M4 11h13M4 16h8M16 14.5l5.5 3.2-5.5 3.2z',
  // Contour quand le titre n'est pas aime, rempli quand il l'est : c'est le
  // meme trace, `Icon` s'occupe du remplissage.
  heart: 'M12 20.5 4.2 12.9a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 1 1 6.5 6.5z',
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
