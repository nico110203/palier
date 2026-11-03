import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type Tab = 'seance' | 'historique' | 'exercices'

export type View =
  | { type: 'workout'; sessionId: number }
  | { type: 'exercise'; id: number }
  | { type: 'session'; id: number }
  | { type: 'template'; id: number }
  | { type: 'notes' }

interface Nav {
  tab: Tab
  view: View | null
  setTab: (t: Tab) => void
  open: (v: View) => void
  back: () => void
  rest: { endAt: number; total: number } | null
  startRest: (seconds: number) => void
  stopRest: () => void
  addRest: (seconds: number) => void
}

export const NavContext = createContext<Nav>(null!)
export const useNav = () => useContext(NavContext)

/** Pile de vues synchronisée avec l'historique du navigateur, pour le bouton retour d'Android. */
export function useNavState(): Nav {
  const [tab, setTabState] = useState<Tab>('seance')
  const [stack, setStack] = useState<View[]>([])
  const [rest, setRest] = useState<Nav['rest']>(null)
  const depth = useRef(0)

  useEffect(() => {
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
    window.scrollTo(0, 0)
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
    window.scrollTo(0, 0)
  }, [])

  return {
    tab,
    view: stack[stack.length - 1] ?? null,
    setTab,
    open,
    back,
    rest,
    startRest: useCallback((s: number) => setRest(s > 0 ? { endAt: Date.now() + s * 1000, total: s } : null), []),
    stopRest: useCallback(() => setRest(null), []),
    addRest: useCallback((s: number) => setRest((r) => (r ? { endAt: r.endAt + s * 1000, total: r.total + s } : r)), []),
  }
}
