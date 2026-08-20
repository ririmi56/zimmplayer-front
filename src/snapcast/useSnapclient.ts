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
 * Un démarrage est en cours.
 *
 * Deux composants appellent ce hook (`SnapVolume` et Configuration) : leurs
 * effets peuvent demander le démarrage en même temps. Le client n'entrant
 * dans le store qu'une fois démarré, il ne suffit plus à les départager — d'où
 * ce drapeau. Hors du store : il ne concerne aucun rendu.
 */
let demarrageEnCours = false

/**
 * Combien de fois demander à snapserver s'il connaît enfin ce client, et à
 * quel rythme. Deux secondes en tout : bien au-delà du délai observé (moins
 * d'une), assez court pour ne pas laisser une reprise traîner.
 */
const JOIN_ATTEMPTS = 8
const JOIN_RETRY_MS = 250

/**
 * Fait du navigateur un snapclient à part entière, en plus d'être la
 * télécommande. Il apparaît alors dans les groupes de snapserver comme une
 * enceinte, ce qui rend l'identification « c'est moi » automatique.
 *
 * La lecture ne peut pas démarrer toute seule : les navigateurs exigent un
 * geste utilisateur pour ouvrir un AudioContext. On mémorise la préférence, on
 * retente au chargement, et si c'est refusé on réessaie au premier geste venu
 * — sans que l'utilisateur ait à retrouver le bouton casque.
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
    if (useSnapclientStore.getState().client || demarrageEnCours) return false
    demarrageEnCours = true
    const client = new SnapcastClient(streamUrl(), clientId, name || 'Navigateur', (status) =>
      useSnapclientStore.setState({ status }),
    )
    try {
      await client.start()
      // Le client n'entre dans le store qu'une fois REELLEMENT demarre.
      // L'y mettre avant l'attente faisait afficher « en ecoute » a
      // l'interface alors que rien n'etait connecte — l'etat que laissait
      // tout rechargement de page.
      useSnapclientStore.setState({ client, needsGesture: false })
      return true
    } catch {
      // AudioContext refusé faute de geste utilisateur. On libère le contexte
      // suspendu : le suivant en créera un neuf.
      await client.stop().catch(() => {})
      useSnapclientStore.setState({ client: null, needsGesture: true })
      return false
    } finally {
      demarrageEnCours = false
    }
  }, [clientId, name])

  /**
   * Rattache ce navigateur au flux de la session courante.
   *
   * Sans cela, snapserver le placerait dans un groupe à part jouant la source
   * par défaut : on entendrait le silence en croyant écouter la session.
   *
   * Relit la session par un appel direct plutot que de fermer sur `session` :
   * appele juste apres « Rejoindre », ce callback tourne alors que le clic
   * vient tout juste de definir `sessionId` — la reponse reactive n'a pas
   * forcement eu le temps d'arriver, `session` fermerait alors sur `undefined`.
   *
   * Attend que snapserver connaisse ce client avant de conclure. Il ne le
   * connait qu'une fois le `Hello` du protocole recu, ce qui prend un instant
   * apres l'ouverture de la WebSocket. Un delai fixe faisait l'affaire tant
   * qu'un humain cliquait ; sur une reprise automatique, echouer ici veut dire
   * ecouter le silence sans que personne n'ait rien demande.
   */
  const joinSessionStream = useCallback(async () => {
    const sessionId = useIdentity.getState().sessionId
    if (sessionId == null) return
    const streamId = (await api.session(sessionId).catch(() => null))?.snapcast_stream_id
    if (!streamId) return
    for (let essai = 0; essai < JOIN_ATTEMPTS; essai++) {
      const status = await api.snapcastStatus().catch(() => null)
      const group = status?.groups.find((g) => g.clients.some((c) => c.id === clientId))
      if (group) {
        if (group.stream_id !== streamId) await api.setGroupStream(group.id, streamId)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, JOIN_RETRY_MS))
    }
  }, [clientId])

  /**
   * Démarrer, puis se rattacher au flux : les deux vont toujours ensemble.
   *
   * C'est le manque de la seconde moitié sur le chemin automatique qui rendait
   * un rechargement de page muet — le navigateur redevenait bien un snapclient,
   * mais dans un groupe jouant la source par défaut.
   */
  const listenIci = useCallback(async () => {
    if (await start()) await joinSessionStream()
  }, [start, joinSessionStream])

  const listen = useCallback(async () => {
    setListenHere(true)
    await listenIci()
  }, [setListenHere, listenIci])

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
    if (listenHere) void listenIci()
  }, [available, listenHere, listenIci, stop])

  /**
   * Reprise automatique après un rechargement de page.
   *
   * Les navigateurs refusent d'ouvrir l'audio tant que la page n'a reçu aucun
   * geste ; il n'existe aucun moyen de contourner cette règle, et il ne faut
   * pas en chercher. Ce qu'on peut faire, c'est ne plus obliger à retrouver le
   * bouton casque : le PREMIER geste venu, où qu'il ait lieu dans la page,
   * relance la lecture. Un clic quelconque, une touche, et le son revient.
   *
   * `click` en phase de BULLE, et surtout pas `pointerdown` en capture — ce
   * détail décide de tout. React branche ses gestionnaires sur la racine de
   * l'application ; un écouteur de fenêtre en bulle passe donc APRÈS eux.
   * Avec `pointerdown` en capture, une pression sur le bouton casque
   * lui-même rebranchait la lecture avant que le bouton ne réagisse : celui-ci
   * voyait alors un client déjà en écoute et appelait `mute()`. Le même clic
   * faisait les deux, et rien ne se passait. Mesuré, puis corrigé ainsi.
   *
   * Dans cet ordre, un clic sur le casque est traité par le bouton seul : la
   * reprise qui suit ne trouve plus rien à faire et s'abstient.
   */
  useEffect(() => {
    if (!needsGesture || !available || !listenHere) return
    const reprendre = () => void listenIci()
    window.addEventListener('click', reprendre, { once: true })
    window.addEventListener('keydown', reprendre, { once: true })
    return () => {
      window.removeEventListener('click', reprendre)
      window.removeEventListener('keydown', reprendre)
    }
  }, [needsGesture, available, listenHere, listenIci])

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
