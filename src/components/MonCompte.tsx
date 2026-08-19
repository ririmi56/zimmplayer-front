import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth, useDisplayName } from '../state/auth'
import { Avatar } from './Avatar'

/**
 * Qui je suis, en bas de la navigation, et de quoi en sortir.
 *
 * Deux mondes derriere le meme bouton : avec OIDC il y a une session a
 * fermer, sans OIDC il n'y a qu'un pseudo de navigateur — proposer « se
 * deconnecter » n'y voudrait rien dire.
 */
export function MonCompte() {
  const auth = useAuth()
  const name = useDisplayName()
  const navigate = useNavigate()
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const fermer = (event: MouseEvent) => {
      if (!boite.current?.contains(event.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', fermer, true)
    return () => document.removeEventListener('mousedown', fermer, true)
  }, [ouvert])

  const deconnecter = async () => {
    const { provider_logout_url } = await api.logout()
    // Le fournisseur n'expose pas toujours de deconnexion globale : sans
    // elle, fermer la session locale est tout ce qu'on peut faire.
    location.href = provider_logout_url ?? '/'
  }

  return (
    <div ref={boite} className="relative mt-auto">
      <button
        onClick={() => setOuvert((etat) => !etat)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-neutral-900"
      >
        <Avatar name={name} picture={auth.picture} className="h-8 w-8" />
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">
          {name || 'Pseudo non défini'}
        </span>
      </button>

      {ouvert && (
        // Vers le haut : le bouton est colle au bas de la fenetre, un menu
        // deroulant vers le bas sortirait de l'ecran.
        <div className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
          <div className="flex items-center gap-3">
            <Avatar name={name} picture={auth.picture} className="h-10 w-10" />
            <div className="min-w-0">
              <div className="truncate text-sm text-neutral-100">
                {name || 'Pseudo non défini'}
              </div>
              {auth.oidc_enabled && auth.email && (
                <div className="truncate text-xs text-neutral-500">{auth.email}</div>
              )}
            </div>
          </div>

          {auth.oidc_enabled ? (
            <button
              onClick={deconnecter}
              className="mt-3 w-full rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
            >
              Se déconnecter
            </button>
          ) : (
            <button
              onClick={() => {
                setOuvert(false)
                navigate('/settings')
              }}
              className="mt-3 w-full rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
            >
              {name ? 'Changer de pseudo' : 'Choisir un pseudo'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
