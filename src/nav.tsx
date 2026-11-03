import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type Tab = 'muscles' | 'historique' | 'exercices'

export type View = { type: 'muscle'; id: number } | { type: 'exercise'; id: number } | { type: 'notes' }

interface Nav {
  tab: Tab
  view: View | null
  setTab: (t: Tab) => void
  open: (v: View) => void
  back: () => void
}

export const NavContext = createContext<Nav>(null!)
export const useNav = () => useContext(NavContext)

/** Pile de vues synchronisée avec l'historique du navigateur, pour le bouton retour d'Android. */
export function useNavState(): Nav {
  const [tab, setTabState] = useState<Tab>('muscles')
  const [stack, setStack] = useState<View[]>([])
  const depth = useRef(0)

  useEffect(() => {
    // Le navigateur ne restaure pas la position au retour : c'est App qui gère le défilement.
    history.scrollRestoration = 'manual'
    const onPop = () => {
      if (depth.current > 0) {
        depth.current--
        setStack((s) => s.slice(0, -1))
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((v: View) => {
    depth.current++
    history.pushState({ depth: depth.current }, '')
    setStack((s) => [...s, v])
  }, [])

  const back = useCallback(() => {
    if (depth.current > 0) history.back()
  }, [])

  const setTab = useCallback((t: Tab) => {
    if (depth.current > 0) {
      history.go(-depth.current)
      depth.current = 0
      setStack([])
    }
    setTabState(t)
  }, [])

  return {
    tab,
    view: stack[stack.length - 1] ?? null,
    setTab,
    open,
    back,
  }
}
