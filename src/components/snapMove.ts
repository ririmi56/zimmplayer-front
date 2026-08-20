import type { SnapGroup, SnapRawResult } from '../api/client'

/**
 * Ce qu'il faut demander a snapserver pour qu'un appareil passe sur le flux
 * `streamId` — donc pour qu'il rejoigne une autre session, ou n'en ecoute
 * plus aucune.
 *
 * Un groupe Snapcast n'est pas une zone qu'on configure : c'est un detail
 * ephemere, cree et detruit par le serveur. Trois comportements de
 * snapserver 0.29, verifies contre le serveur de `docker-compose.dev.yml`,
 * dictent entierement ce plan :
 *
 * 1. `Group.SetClients` sur un groupe deja pose sur le bon flux y fait entrer
 *    l'appareil, et le **groupe qu'il quitte disparait** s'il devient vide ;
 * 2. retirer un appareil d'un groupe lui **cree un groupe neuf**, dont
 *    l'identifiant n'existait pas avant l'appel ;
 * 3. ce groupe neuf **herite du flux** de celui qu'on vient de quitter. Sortir
 *    quelqu'un d'une session demande donc un second appel : sans lui, il
 *    continue de l'entendre, seul dans son coin.
 */
export type MovePlan =
  /** Deja sur le bon flux, ou appareil inconnu du serveur. */
  | { kind: 'none' }
  /** Un groupe ecoute deja ce flux : on l'y fait entrer. */
  | { kind: 'join'; groupId: string; clientIds: string[] }
  /** Seul dans son groupe : on emmene le groupe entier, sans en creer un. */
  | { kind: 'retarget'; groupId: string; streamId: string }
  /** Accompagne, et rien a rejoindre : detacher, puis poser le flux (cf. 3). */
  | { kind: 'detach'; groupId: string; keep: string[]; streamId: string }

export function planMove(
  groups: SnapGroup[],
  clientId: string,
  streamId: string,
): MovePlan {
  const current = groups.find((g) => g.clients.some((c) => c.id === clientId))
  if (!current || current.stream_id === streamId) return { kind: 'none' }

  const target = groups.find((g) => g.id !== current.id && g.stream_id === streamId)
  if (target) {
    return {
      kind: 'join',
      groupId: target.id,
      clientIds: [...target.clients.map((c) => c.id), clientId],
    }
  }

  if (current.clients.length === 1) {
    return { kind: 'retarget', groupId: current.id, streamId }
  }

  return {
    kind: 'detach',
    groupId: current.id,
    keep: current.clients.filter((c) => c.id !== clientId).map((c) => c.id),
    streamId,
  }
}

/**
 * Ou snapserver vient de poser cet appareil, lu dans la reponse de l'appel.
 *
 * Le groupe cree par un detachement n'a pas d'identifiant previsible : il faut
 * le relire. `Group.SetClients` repond l'etat complet du serveur, ce qui evite
 * d'aller le redemander.
 */
export function groupOf(result: SnapRawResult, clientId: string): string | null {
  const group = result.server.groups.find((g) => g.clients.some((c) => c.id === clientId))
  return group?.id ?? null
}

/**
 * Un flux qui n'est la session de personne, pour y ranger un appareil qu'on
 * met « a part ».
 *
 * Snapcast n'a pas de « pas de flux » : un groupe en ecoute toujours un. En
 * developpement c'est `silence`, mais rien ne le garantit sur le snapserver du
 * reseau, ou les flux sont ceux de son proprietaire. On prend donc le premier
 * qu'aucune session ne revendique, et l'appelant desactive l'option quand il
 * n'y en a aucun — plutot que d'inventer un nom qui echouerait a l'appel.
 */
export function apartStream(
  streams: { id: string }[],
  sessionStreamIds: (string | null | undefined)[],
): string | null {
  const pris = new Set(sessionStreamIds.filter((id): id is string => !!id))
  return streams.find((s) => !pris.has(s.id))?.id ?? null
}
