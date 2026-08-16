import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setUserName } from '../api/client'

type IdentityState = {
  /** Pseudo affiche a cote des titres qu'on ajoute a une file partagee. */
  name: string
  /** Session d'ecoute rejointe, null pour une ecoute solo dans le navigateur. */
  sessionId: number | null
  /**
   * Ce navigateur doit-il jouer le flux Snapcast ?
   *
   * Il n'y a plus de « ma piece » a declarer : en mode Snapcast le navigateur
   * est lui-meme un snapclient, il apparait donc dans les groupes du serveur et
   * s'y reconnait tout seul par son identifiant.
   */
  listenHere: boolean

  setName: (name: string) => void
  setSessionId: (sessionId: number | null) => void
  setListenHere: (listenHere: boolean) => void
}

export const useIdentity = create<IdentityState>()(
  persist(
    (set) => ({
      name: '',
      sessionId: null,
      listenHere: false,
      setName: (name) => {
        setUserName(name)
        set({ name })
      },
      setSessionId: (sessionId) => set({ sessionId }),
      setListenHere: (listenHere) => set({ listenHere }),
    }),
    {
      name: 'audioplayer.identity',
      // Le client API garde le pseudo dans une variable : il faut le lui
      // redonner apres rechargement de la page.
      onRehydrateStorage: () => (state) => {
        if (state?.name) setUserName(state.name)
      },
    },
  ),
)
