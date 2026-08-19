import { useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { QueuePanel } from './components/QueuePanel'
import { AudioEngine } from './player/AudioEngine'
import { LyricsPanel } from './player/LyricsPanel'
import { PlayerBar } from './player/PlayerBar'
import { RemoteBar } from './player/RemoteBar'
import { Admin } from './routes/Admin'
import { Album } from './routes/Album'
import { Artist } from './routes/Artist'
import { Artists } from './routes/Artists'
import { Genres } from './routes/Genres'
import { Library } from './routes/Library'
import { NowPlaying } from './routes/NowPlaying'
import { Search } from './routes/Search'
import { Sessions } from './routes/Sessions'
import { Settings } from './routes/Settings'
import { useAuth, useDisplayName } from './state/auth'
import { Connexion } from './routes/Connexion'
import { useCurrentSession } from './state/session'

/**
 * Navigation en trois blocs : ce qui joue, ce qu'on parcourt, le reste.
 *
 * « Bibliothèque » est un intitulé de section et non un lien : il n'a rien à
 * montrer que ses trois entrées ne montrent déjà, et un lien de plus vers la
 * page Albums ne ferait que dédoubler la destination.
 */
const NAV: { to: string; label: string; section?: string }[] = [
  { to: '/lecture', label: 'Lecture' },
  { to: '/', label: 'Albums', section: 'Bibliothèque' },
  { to: '/artists', label: 'Artistes', section: 'Bibliothèque' },
  { to: '/genres', label: 'Genres', section: 'Bibliothèque' },
  { to: '/sessions', label: "Sessions d'écoute" },
  { to: '/settings', label: 'Configuration' },
  { to: '/admin', label: 'Administration' },
]

function SearchBox() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) navigate(`/search?q=${encodeURIComponent(value.trim())}`)
      }}
      role="search"
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Rechercher…"
        aria-label="Rechercher"
        className="w-full rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
      />
    </form>
  )
}

function SessionBadge() {
  const { data: session } = useCurrentSession()
  if (!session) return null
  return (
    <NavLink
      to="/sessions"
      className="flex items-center gap-2 truncate rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500"
    >
      <span className="truncate">{session.name}</span>
      <span className="rounded bg-sky-500/20 px-1.5 text-[10px] uppercase text-sky-300">
        snapcast
      </span>
    </NavLink>
  )
}

export default function App() {
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const { data: session } = useCurrentSession()
  const name = useDisplayName()
  const auth = useAuth()

  // Rejoindre une session, c'est se synchroniser via Snapcast : le son sort
  // du serveur, ce navigateur ne doit rien jouer lui-meme, sous peine de
  // doubler la lecture avec un decalage. Hors session, ecoute solo locale.
  const remote = session != null

  // Avec OIDC, rien de l'application ne s'affiche tant que l'identite n'est
  // pas etablie : l'ecran de connexion prend toute la place. Sans OIDC, ce
  // cas ne se presente jamais — `authenticated` vaut toujours vrai.
  if (auth.oidc_enabled && !auth.authenticated) return <Connexion />

  const barProps = {
    lyricsOpen,
    onToggleLyrics: () => setLyricsOpen((open) => !open),
    queueOpen,
    onToggleQueue: () => setQueueOpen((open) => !open),
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-900 text-neutral-200">
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-6 px-2 text-lg font-semibold text-neutral-100">Zimmplayer</div>
          {NAV.map((item, position) => (
            <div key={item.to}>
              {item.section && item.section !== NAV[position - 1]?.section && (
                <div className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {item.section}
                </div>
              )}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `block rounded py-2 text-sm ${item.section ? 'pl-6 pr-3' : 'px-3'} ${
                    isActive
                      ? 'bg-neutral-800 text-neutral-100'
                      : 'text-neutral-400 hover:text-neutral-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </div>
          ))}
          <div className="mt-auto px-2 text-xs text-neutral-600">
            {name ? `Connecté en tant que ${name}` : 'Pseudo non défini'}
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-800 bg-neutral-900/95 px-8 py-3 backdrop-blur">
            <div className="max-w-sm flex-1">
              <SearchBox />
            </div>
            <SessionBadge />
          </div>
          <div className="px-8 py-6">
            <Routes>
              <Route path="/" element={<Library />} />
              <Route path="/lecture" element={<NowPlaying />} />
              <Route path="/artists" element={<Artists />} />
              <Route path="/artists/:id" element={<Artist />} />
              <Route path="/albums/:id" element={<Album />} />
              <Route path="/genres" element={<Genres />} />
              <Route path="/search" element={<Search />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </div>
        </main>

        {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
        {lyricsOpen && <LyricsPanel onClose={() => setLyricsOpen(false)} />}
      </div>

      {remote ? <RemoteBar {...barProps} /> : <PlayerBar {...barProps} />}
      {/* Monte une seule fois, hors des routes : la lecture survit à la
          navigation. Retire en session, ou le son sortirait deux fois. */}
      {!remote && <AudioEngine />}
    </div>
  )
}
