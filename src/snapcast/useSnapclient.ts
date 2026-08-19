import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { api } from '../api/client'
import { useIdentity } from '../state/identity'
import { useDisplayName } from '../state/auth'
import { useCurrentSession } from '../state/session'
import { SnapcastClient, browserClientId, type SnapStatus } from './client'

const IDLE: SnapStatus = {
  state: 'idle',
  error: null,
  offsetMs: 0,
  samples: 0,
  played: 0,
  late: 0,
  driftMs: 0,
  resyncs: 0,
}

/** URL du relais, sur la même origine que l'application. */
function streamUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/api/snapcast/stream`
}

/**
 * Le client Snapcast de ce navigateur, et son etat : un seul pour toute
 * l'application, pas un par composant qui appelle `useSnapclient`.
 *
 * `RemoteBar` (barre de lecture) et `LocalListening` (Configuration) appellent
 * toutes les deux ce hook. Avec un `useState`/`useRef` local a chacune, elles
 * ouvriraient deux `SnapcastClient` independants — cliquer « Ecouter ici »
 * dans l'une resterait invisible depuis l'autre. Le store partage donc l'etat,
 * et le cycle de vie du client ne depend plus du montage d'un composant
 * particulier.
 */
const useSnapclientStore = create<{
  status: SnapStatus
  needsGesture: boolean
  client: SnapcastClient | null
}>(() => ({
  status: IDLE,
  needsGesture: false,
  client: null,
}))

/**
 * Fait du navigateur un snapclient à part entière, en plus d'être la
 * télécommande. Il apparaît alors dans les groupes de snapserver comme une
 * enceinte, ce qui rend l'identification « c'est moi » automatique.
 *
 * La lecture ne peut pas démarrer toute seule : les navigateurs exigent un
 * geste utilisateur pour ouvrir un AudioContext. On mémorise la préférence et
 * on retente au chargement ; si c'est refusé, le bouton reste proposé.
 */
export function useSnapclient() {
  const { data: session } = useCurrentSession()
  const { listenHere, setListenHere } = useIdentity()
  // Le nom du snapclient est celui de l'identite, jamais un renommage a part.
  const name = useDisplayName()
  const status = useSnapclientStore((s) => s.status)
  const needsGesture = useSnapclientStore((s) => s.needsGesture)
  const listening = useSnapclientStore((s) => s.client !== null)

  const available = session != null
  const clientId = browserClientId()

  const stop = useCallback(async () => {
    await useSnapclientStore.getState().client?.stop()
    useSnapclientStore.setState({ client: null, status: IDLE })
  }, [])

  const start = useCallback(async () => {
    if (useSnapclientStore.getState().client) return
    const client = new SnapcastClient(streamUrl(), clientId, name || 'Navigateur', (status) =>
      useSnapclientStore.setState({ status }),
    )
    useSnapclientStore.setState({ client })
    try {
      await client.start()
      useSnapclientStore.setState({ needsGesture: false })
    } catch {
      // AudioContext refusé faute de geste utilisateur.
      useSnapclientStore.setState({ client: null, needsGesture: true })
    }
  }, [clientId, name])

  /**
   * Rattache ce navigateur au flux de la session courante.
   *
   * Sans cela, snapserver le placerait dans un groupe à part jouant la source
   * par défaut : on entendrait le silence en croyant écouter la session.
   *
   * Relit la session par un appel direct plutot que de fermer sur `session` :
   * appele depuis « Rejoindre », ce callback s'execute 800 ms apres un clic
   * qui vient tout juste de definir `sessionId` — la reponse reactive n'a pas
   * forcement eu le temps d'arriver, `session` fermerait alors sur `undefined`.
   */
  const joinSessionStream = useCallback(async () => {
    const sessionId = useIdentity.getState().sessionId
    if (sessionId == null) return
    const streamId = (await api.session(sessionId).catch(() => null))?.snapcast_stream_id
    if (!streamId) return
    const status = await api.snapcastStatus()
    const group = status.groups.find((g) => g.clients.some((c) => c.id === clientId))
    if (group && group.stream_id !== streamId) {
      await api.setGroupStream(group.id, streamId)
    }
  }, [clientId])

  const listen = useCallback(async () => {
    setListenHere(true)
    await start()
    // Le client doit s'être annoncé avant que snapserver ne le connaisse.
    window.setTimeout(() => void joinSessionStream(), 800)
  }, [setListenHere, start, joinSessionStream])

  const mute = useCallback(async () => {
    setListenHere(false)
    await stop()
  }, [setListenHere, stop])

  // La session peut être quittée ou supprimée : on coupe. Le client est
  // partage, donc ce cycle de vie ne doit dependre que de la session, jamais
  // du montage ou demontage d'un composant particulier qui appelle ce hook.
  useEffect(() => {
    if (!available) {
      void stop()
      return
    }
    if (listenHere) void start()
  }, [available, listenHere, start, stop])

  const setVolume = useCallback((volume: number, muted: boolean) => {
    useSnapclientStore.getState().client?.setVolume(volume, muted)
  }, [])

  const resync = useCallback(() => {
    useSnapclientStore.getState().client?.resync()
  }, [])

  return {
    available,
    listening,
    needsGesture,
    status,
    clientId,
    listen,
    mute,
    setVolume,
    resync,
  }
}
