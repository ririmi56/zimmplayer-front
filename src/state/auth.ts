import { useQuery } from '@tanstack/react-query'
import { api, type AuthStatus } from '../api/client'
import { useIdentity } from './identity'

const INCONNU: AuthStatus = {
  oidc_enabled: false,
  authenticated: true,
  subject: '',
  name: '',
  email: '',
  groups: [],
  role: 'admin',
  is_super_admin: true,
}

/**
 * Qui est connecte, et comment l'application authentifie.
 *
 * Interroge en permanence : la session a une duree de vie, et c'est la
 * reponse du serveur — jamais un etat local — qui dit si elle tient encore.
 */
export function useAuth() {
  const { data } = useQuery({
    queryKey: ['auth'],
    queryFn: api.authStatus,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
  return data ?? INCONNU
}

/**
 * Nom a afficher et a transmettre, quelle que soit la source.
 *
 * Avec OIDC, il vient du fournisseur et ne se saisit plus. Sans OIDC, c'est
 * le pseudo de ce navigateur. Un seul point de lecture, pour que le nom du
 * snapclient, la file partagee et l'ecran de configuration ne puissent pas
 * diverger.
 */
export function useDisplayName(): string {
  const auth = useAuth()
  const pseudo = useIdentity((s) => s.name)
  // Sans OIDC, `useIdentity` maintient deja l'en-tete X-User-Name du client
  // API. Avec OIDC, l'API cesse de la lire : c'est le cookie qui fait foi.
  return auth.oidc_enabled ? auth.name : pseudo
}
