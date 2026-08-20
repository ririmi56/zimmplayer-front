import { Link } from 'react-router-dom'
import type { Album } from '../api/client'
import { AlbumMenu } from './AlbumMenu'
import { FavoriteButton } from './FavoriteButton'
import { Cover } from './Cover'

export function AlbumGrid({ albums }: { albums: Album[] }) {
  if (albums.length === 0) {
    return <p className="px-1 py-8 text-sm text-neutral-500">Aucun album.</p>
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
      {albums.map((album) => (
        <Link
          key={album.id}
          to={`/albums/${album.id}`}
          className="group relative rounded-lg p-2 transition hover:bg-neutral-800/50"
        >
          <Cover
            albumId={album.id}
            hasCover={album.has_cover}
            className="mb-2 aspect-square w-full rounded shadow-lg"
            alt={album.title}
          />
          {/* Se place lui-meme sur la pochette : il doit se reperer par
              rapport a la vignette, pas par rapport a un coin. */}
          <AlbumMenu albumId={album.id} albumTitle={album.title} />
          {/* En vis-a-vis du kebab, a l'autre coin de la pochette. */}
          <FavoriteButton
            albumId={album.id}
            albumTitle={album.title}
            discret
            size="h-5 w-5"
            className="absolute left-3 top-3 z-10 rounded-full bg-neutral-950/70 p-1 backdrop-blur"
          />
          <div className="truncate text-sm font-medium text-neutral-100">{album.title}</div>
          <div className="truncate text-xs text-neutral-500">
            {album.year ? `${album.year} · ` : ''}
            {album.artist_name}
          </div>
        </Link>
      ))}
    </div>
  )
}
