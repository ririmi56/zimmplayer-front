import { useEffect, useRef } from 'react'

/**
 * Sentinelle de bas de liste : declenche le chargement de la page suivante des
 * qu'elle approche de l'ecran. Rendre le `<div ref={...} />` retourne juste
 * apres la liste.
 *
 * Prend les champs d'un `useInfiniteQuery` plutot que la requete entiere : cela
 * evite d'avoir a typer la forme des pages, dont ce fichier n'a que faire.
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}) {
  const sentinel = useRef<HTMLDivElement>(null)

  // `isFetchingNextPage` fait partie des dependances a dessein : un
  // IntersectionObserver ne signale qu'un CHANGEMENT de visibilite, donc une
  // sentinelle restee a l'ecran (fenetre haute, page suivante courte) ne
  // redeclencherait jamais rien. La recreer apres chaque chargement la refait
  // parler tant qu'il reste des pages.
  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage || isFetchingNextPage) return
    // La marge declenche le chargement avant que la sentinelle n'entre
    // reellement dans l'ecran : le defilement ne marque pas d'arret.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return sentinel
}
