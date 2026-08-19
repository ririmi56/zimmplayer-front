import { useEffect, useState } from 'react'
import { initiale, teinte } from './avatar'

/**
 * Photo du fournisseur, ou initiale dessinee.
 *
 * L'image est chargee par le navigateur directement chez le fournisseur : en
 * reseau ferme elle peut ne jamais arriver, et une photo cassee est pire que
 * pas de photo. D'ou le repli sur l'initiale des que le chargement echoue.
 */
export function Avatar({
  name,
  picture,
  className = 'h-8 w-8',
}: {
  name: string
  picture?: string
  className?: string
}) {
  const [echouee, setEchouee] = useState(false)
  // Changer de personne doit redonner sa chance a la nouvelle photo.
  useEffect(() => setEchouee(false), [picture])

  if (picture && !echouee) {
    return (
      <img
        src={picture}
        alt=""
        onError={() => setEchouee(true)}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    )
  }

  const angle = teinte(name)
  return (
    <span
      aria-hidden
      style={{
        backgroundColor: `hsl(${angle} 45% 30%)`,
        color: `hsl(${angle} 70% 85%)`,
      }}
      className={`${className} flex shrink-0 items-center justify-center rounded-full text-sm font-medium`}
    >
      {initiale(name)}
    </span>
  )
}
