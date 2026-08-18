import type { components } from './schema'

export type Artist = components['schemas']['ArtistOut']
export type ArtistDetail = components['schemas']['ArtistDetail']
export type Album = components['schemas']['AlbumOut']
export type AlbumDetail = components['schemas']['AlbumDetail']
export type Track = components['schemas']['TrackOut']
export type SearchResults = components['schemas']['SearchResults']
export type Genre = components['schemas']['GenreOut']
export type Lyrics = components['schemas']['LyricsOut']
export type ScanRun = components['schemas']['ScanRunOut']
export type SessionSummary = components['schemas']['SessionOut']
export type SessionDetail = components['schemas']['SessionDetail']
export type QueueItem = components['schemas']['QueueItemOut']

export type SnapcastConfig = {
  host: string
  /** Port HTTP/WebSocket de snapserver : controle JSON-RPC et audio. */
  http_port: number
  enabled: boolean
  advertise_host: string
}
export type SnapClient = {
  id: string
  name: string
  connected: boolean
  volume: number
  muted: boolean
  latency: number
  host_name: string | null
  ip: string | null
  os: string | null
}
export type SnapGroup = {
  id: string
  name: string
  muted: boolean
  stream_id: string | null
  clients: SnapClient[]
}
export type SnapcastStatus = {
  connected: boolean
  error: string | null
  groups: SnapGroup[]
  streams: { id: string; status: string }[]
}
/** Reponse brute d'un appel Group.* : forme snapserver, pas la forme normalisee. */
export type SnapRawResult = {
  server: { groups: { id: string; stream_id: string | null; clients: { id: string }[] }[] }
}
export type ScanError = components['schemas']['ScanErrorOut']
export type AuthStatus = components['schemas']['AuthStatus']
export type AppUser = components['schemas']['UserOut']
export type Person = components['schemas']['PersonOut']
export type Playlist = components['schemas']['PlaylistOut']
export type PlaylistDetail = components['schemas']['PlaylistDetail']
export type Page<T> = { items: T[]; total: number; limit: number; offset: number }

/** Pseudo courant, lu au moment de l'appel pour suivre les changements. */
let userName = 'anonyme'
export const setUserName = (name: string) => {
  userName = name || 'anonyme'
}

/**
 * Porte le code HTTP, pas seulement un message : `useCurrentSession` s'en sert
 * pour distinguer un 404 (session supprimee par quelqu'un d'autre, a quitter)
 * d'un simple accroc reseau (a laisser le prochain sondage resoudre seul).
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Identite en v1 : un simple pseudo. Le jour d'OIDC, c'est un jeton qui
      // prendra sa place, sans rien changer aux appels ci-dessous.
      'X-User-Name': userName,
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new ApiError(response.status, detail?.detail ?? `Erreur ${response.status}`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  artists: (params: { q?: string; limit?: number; offset?: number } = {}) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.limit != null) search.set('limit', String(params.limit))
    if (params.offset) search.set('offset', String(params.offset))
    return request<Page<Artist>>(`/api/artists?${search}`)
  },
  artist: (id: number) => request<ArtistDetail>(`/api/artists/${id}`),
  albums: (
    params: {
      q?: string
      artistId?: number
      genre?: string
      /** Defaut du serveur : 100, plafonne a 500. */
      limit?: number
      offset?: number
    } = {},
  ) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.artistId) search.set('artist_id', String(params.artistId))
    if (params.genre) search.set('genre', params.genre)
    if (params.limit != null) search.set('limit', String(params.limit))
    if (params.offset) search.set('offset', String(params.offset))
    return request<Page<Album>>(`/api/albums?${search}`)
  },
  authStatus: () => request<AuthStatus>('/api/auth/me'),
  users: () => request<AppUser[]>('/api/admin/users'),
  people: () => request<Person[]>('/api/users'),

  playlists: () => request<Playlist[]>('/api/playlists'),
  playlist: (id: number) => request<PlaylistDetail>(`/api/playlists/${id}`),
  createPlaylist: (name: string) =>
    request<PlaylistDetail>('/api/playlists', { method: 'POST', body: JSON.stringify({ name }) }),
  renamePlaylist: (id: number, name: string) =>
    request<PlaylistDetail>(`/api/playlists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deletePlaylist: (id: number) => request<void>(`/api/playlists/${id}`, { method: 'DELETE' }),
  addToPlaylist: (id: number, body: { track_ids?: number[]; album_id?: number }) =>
    request<PlaylistDetail>(`/api/playlists/${id}/tracks`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeFromPlaylist: (id: number, itemId: number) =>
    request<PlaylistDetail>(`/api/playlists/${id}/tracks/${itemId}`, { method: 'DELETE' }),
  sharePlaylist: (id: number, userId: number, canEdit: boolean) =>
    request<PlaylistDetail>(`/api/playlists/${id}/shares/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ can_edit: canEdit }),
    }),
  unsharePlaylist: (id: number, userId: number) =>
    request<PlaylistDetail>(`/api/playlists/${id}/shares/${userId}`, { method: 'DELETE' }),
  setUserAdmin: (id: number, isAdmin: boolean) =>
    request<AppUser>(`/api/admin/users/${id}/admin`, {
      method: 'PUT',
      body: JSON.stringify({ is_admin: isAdmin }),
    }),
  logout: () => request<{ provider_logout_url: string | null }>('/api/auth/logout', {
    method: 'POST',
  }),

  genres: () => request<Genre[]>('/api/genres'),
  lyrics: (trackId: number) => request<Lyrics>(`/api/tracks/${trackId}/lyrics`),
  album: (id: number) => request<AlbumDetail>(`/api/albums/${id}`),
  search: (q: string) => request<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),

  updateTrack: (id: number, body: Partial<Record<'title' | 'track_no' | 'disc_no', unknown>>) =>
    request<Track>(`/api/tracks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateAlbum: (id: number, body: Partial<Record<'title' | 'year', unknown>>) =>
    request<Album>(`/api/albums/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  sessions: () => request<SessionSummary[]>('/api/sessions'),
  session: (id: number) => request<SessionDetail>(`/api/sessions/${id}`),
  createSession: (name: string) =>
    request<SessionDetail>('/api/sessions', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteSession: (id: number) =>
    request<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
  enqueue: (id: number, body: { track_ids?: number[]; album_id?: number }) =>
    request<SessionDetail>(`/api/sessions/${id}/queue`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  dequeue: (id: number, itemId: number) =>
    request<SessionDetail>(`/api/sessions/${id}/queue/${itemId}`, { method: 'DELETE' }),
  clearQueue: (id: number) =>
    request<SessionDetail>(`/api/sessions/${id}/queue`, { method: 'DELETE' }),
  moveInQueue: (id: number, itemId: number, to_index: number) =>
    request<SessionDetail>(`/api/sessions/${id}/queue/${itemId}/move`, {
      method: 'POST',
      body: JSON.stringify({ to_index }),
    }),
  sessionPlay: (id: number, itemId?: number) =>
    request<SessionDetail>(
      `/api/sessions/${id}/play${itemId != null ? `?item_id=${itemId}` : ''}`,
      { method: 'POST' },
    ),
  sessionPause: (id: number) =>
    request<SessionDetail>(`/api/sessions/${id}/pause`, { method: 'POST' }),
  sessionNext: (id: number) =>
    request<SessionDetail>(`/api/sessions/${id}/next`, { method: 'POST' }),
  sessionPrevious: (id: number) =>
    request<SessionDetail>(`/api/sessions/${id}/previous`, { method: 'POST' }),
  sessionSeek: (id: number, position_s: number) =>
    request<SessionDetail>(`/api/sessions/${id}/seek`, {
      method: 'POST',
      body: JSON.stringify({ position_s }),
    }),

  snapcastConfig: () => request<SnapcastConfig>('/api/snapcast/config'),
  saveSnapcastConfig: (config: SnapcastConfig) =>
    request<SnapcastConfig>('/api/snapcast/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  snapcastStatus: () => request<SnapcastStatus>('/api/snapcast/status'),
  setClientVolume: (clientId: string, percent: number, muted: boolean) =>
    request<unknown>(`/api/snapcast/clients/${encodeURIComponent(clientId)}/volume`, {
      method: 'POST',
      body: JSON.stringify({ percent, muted }),
    }),
  setClientName: (clientId: string, name: string) =>
    request<unknown>(`/api/snapcast/clients/${encodeURIComponent(clientId)}/name`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),
  setGroupStream: (groupId: string, stream_id: string) =>
    request<unknown>(`/api/snapcast/groups/${encodeURIComponent(groupId)}/stream`, {
      method: 'POST',
      body: JSON.stringify({ stream_id }),
    }),
  setGroupMute: (groupId: string, muted: boolean) =>
    request<unknown>(`/api/snapcast/groups/${encodeURIComponent(groupId)}/mute`, {
      method: 'POST',
      body: JSON.stringify({ muted }),
    }),
  setGroupClients: (groupId: string, clientIds: string[]) =>
    request<SnapRawResult>(`/api/snapcast/groups/${encodeURIComponent(groupId)}/clients`, {
      method: 'POST',
      body: JSON.stringify({ client_ids: clientIds }),
    }),
  setGroupName: (groupId: string, name: string) =>
    request<unknown>(`/api/snapcast/groups/${encodeURIComponent(groupId)}/name`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  startScan: (force = false) =>
    request<ScanRun>(`/api/admin/scan${force ? '?force=true' : ''}`, { method: 'POST' }),
  scanStatus: () => request<ScanRun | null>('/api/admin/scan/status'),
  scanErrors: () => request<ScanError[]>('/api/admin/scan/errors'),
}

export const coverUrl = (albumId: number, size: 'thumb' | 'full' = 'thumb') =>
  `/api/albums/${albumId}/cover?size=${size}`

export const streamUrl = (trackId: number) => `/api/tracks/${trackId}/stream`
