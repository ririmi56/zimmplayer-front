/**
 * Ecran de connexion, affiche a la place de l'application tant que l'identite
 * n'est pas etablie.
 *
 * Le bouton est un vrai lien : `/api/auth/login` repond par une redirection
 * vers le fournisseur, et c'est au navigateur de la suivre. Un `fetch` la
 * suivrait en arriere-plan, sans jamais montrer la page de connexion.
 */
export function Connexion() {
  // Le retour du fournisseur passe l'erreur par l'URL : le callback est une
  // redirection de navigateur, pas un appel de l'interface — un corps
  // d'erreur JSON n'aurait ete affiche nulle part.
  const erreur = new URLSearchParams(location.search).get('auth_error')

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-900 px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-neutral-100">Zimmplayer</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Cette installation utilise l’authentification de votre organisation.
        </p>

        {erreur && (
          <p className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200">
            La connexion a échoué : {erreur}
          </p>
        )}

        <a
          href="/api/auth/login"
          className="mt-8 inline-block rounded-full bg-emerald-500 px-6 py-3 text-sm font-medium text-neutral-950 hover:bg-emerald-400"
        >
          Se connecter
        </a>
      </div>
    </div>
  )
}
