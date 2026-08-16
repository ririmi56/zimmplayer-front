import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { ApiError, api, type SessionDetail } from '../api/client'
import { useIdentity } from './identity'

/**
 * Etat de la session d'ecoute courante, rafraichi par interrogation reguliere.
 *
 * Pas de WebSocket ici : sur un reseau local, interroger le serveur toutes les
 * 1,5 s suffit largement pour une file partagee, et cela evite toute la
 * mecanique de reconnexion et de diffusion. Entre deux reponses, l'interface
 * fait avancer la position elle-meme.
 */
export function useCurrentSession() {
  const sessionId = useIdentity((s) => s.sessionId)
  const setSessionId = useIdentity((s) => s.setSessionId)

  const query = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.session(sessionId!),
    enabled: sessionId != null,
    refetchInterval: 1500,
    // Une file partagee bouge sous nos pieds : jamais de reponse perimee.
    staleTime: 0,
    // Un 404 est definitif (session supprimee) : inutile d'insister, et il
    // vaut mieux le detecter vite plutot que d'attendre 3 tentatives.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  })

  // Quelqu'un d'autre a supprime cette session pendant qu'on l'ecoutait : sans
  // ca, l'appli garde la derniere reponse reussie en cache indefiniment (React
  // Query ne vide pas `data` sur une erreur), et ce navigateur reste
  // orphelin — a continuer de jouer une session qui n'existe plus, sans plus
  // aucun moyen de l'arreter depuis l'interface.
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 404) setSessionId(null)
  }, [query.error, setSessionId])

  return query
}

/** Commandes de lecture et d'edition de file, appliquees au cache a la reponse. */
export function useSessionControl() {
  const sessionId = useIdentity((s) => s.sessionId)
  const queryClient = useQueryClient()

  const wrap = useCallback(
    (call: (id: number) => Promise<SessionDetail>) => async () => {
      if (sessionId == null) return
      queryClient.setQueryData(['session', sessionId], await call(sessionId))
    },
    [sessionId, queryClient],
  )

  return {
    sessionId,
    play: wrap((id) => api.sessionPlay(id)),
    pause: wrap((id) => api.sessionPause(id)),
    next: wrap((id) => api.sessionNext(id)),
    previous: wrap((id) => api.sessionPrevious(id)),
    playItem: useCallback(
      async (itemId: number) => {
        if (sessionId == null) return
        queryClient.setQueryData(
          ['session', sessionId],
          await api.sessionPlay(sessionId, itemId),
        )
      },
      [sessionId, queryClient],
    ),
    seek: useCallback(
      async (position: number) => {
        if (sessionId == null) return
        queryClient.setQueryData(
          ['session', sessionId],
          await api.sessionSeek(sessionId, position),
        )
      },
      [sessionId, queryClient],
    ),
    remove: useCallback(
      async (itemId: number) => {
        if (sessionId == null) return
        queryClient.setQueryData(['session', sessionId], await api.dequeue(sessionId, itemId))
      },
      [sessionId, queryClient],
    ),
    move: useCallback(
      async (itemId: number, toIndex: number) => {
        if (sessionId == null) return
        queryClient.setQueryData(
          ['session', sessionId],
          await api.moveInQueue(sessionId, itemId, toIndex),
        )
      },
      [sessionId, queryClient],
    ),
    clear: wrap((id) => api.clearQueue(id)),
  }
}

/** Ajoute a la file de la session courante, ou signale qu'il n'y en a pas. */
export function useEnqueue() {
  const sessionId = useIdentity((s) => s.sessionId)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: { track_ids?: number[]; album_id?: number }) => {
      if (sessionId == null) throw new Error("Rejoignez une session d'ecoute d'abord")
      return api.enqueue(sessionId, body)
    },
    onSuccess: (detail) => queryClient.setQueryData(['session', sessionId], detail),
  })
}

/**
 * Remplace la file de la session courante et lance la lecture a `startIndex`.
 *
 * Equivalent, dans une session, de ce que `playQueue` fait pour une ecoute
 * solo : « Lire l'album » ou un clic sur un titre doivent avoir le meme effet
 * qu'on soit dans une session ou non.
 */
export function usePlayNowInSession() {
  const sessionId = useIdentity((s) => s.sessionId)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ trackIds, startIndex }: { trackIds: number[]; startIndex: number }) => {
      if (sessionId == null) throw new Error("Rejoignez une session d'ecoute d'abord")
      await api.clearQueue(sessionId)
      const detail = await api.enqueue(sessionId, { track_ids: trackIds })
      const item = detail.items[startIndex]
      return item ? api.sessionPlay(sessionId, item.id) : detail
    },
    onSuccess: (detail) => queryClient.setQueryData(['session', sessionId], detail),
  })
}
