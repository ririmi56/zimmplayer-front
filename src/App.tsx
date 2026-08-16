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
import { Search } from './routes/Search'
import { Sessions } from './routes/Sessions'
import { Settings } from './routes/Settings'
import { useIdentity } from './state/identity'
import { useCurrentSession } from './state/session'

const NAV = [
  { to: '/', label: 'Bibliothèque' },
  { to: '/artists', label: 'Artistes' },
  { to: '/genres', label: 'Genres' },
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
  const name = useIdentity((s) => s.name)

  // Rejoindre une session, c'est se synchroniser via Snapcast : le son sort
  // du serveur, ce navigateur ne doit rien jouer lui-meme, sous peine de
  // doubler la lecture avec un decalage. Hors session, ecoute solo locale.
  const remote = session != null

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
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-100'
                }`
              }
            >
              {item.label}
            </NavLink>
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
