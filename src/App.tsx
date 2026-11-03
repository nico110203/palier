import { useEffect, useLayoutEffect, useState } from 'react'
import { db, getSetting, setSetting } from './db'
import { NavContext, useNavState } from './nav'
import { applyNotes, INITIAL_NOTES, parseNotes } from './notes'
import { Muscles } from './screens/Muscles'
import { MuscleView } from './screens/Muscle'
import { ExerciseDetail } from './screens/History'
import { applyTheme, NotesImport, type Theme } from './screens/Manage'

/** Premier lancement : reprend les notes du bloc-notes. Mémorisé pour le double effet de StrictMode. */
let seeding: Promise<void> | null = null
function seedOnce() {
  seeding ??= (async () => {
    if (!(await getSetting('seeded', false))) {
      if (!(await db.exercises.count())) await applyNotes(parseNotes(INITIAL_NOTES))
      await setSetting('seeded', true)
    }
    // v2 : nom complet sous les abréviations.
    if (!(await getSetting('v2', false))) {
      await db.exercises.filter((e) => e.name === 'DCH' && !e.detail).modify({ detail: 'Développé couché' })
      await setSetting('v2', true)
    }
  })()
  return seeding
}

export default function App() {
  const nav = useNavState()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    navigator.storage?.persist?.()
    getSetting<Theme>('theme', 'auto').then(applyTheme)
    seedOnce().finally(() => setReady(true))
  }, [])

  // Remonte en haut une fois le nouvel écran posé, pas avant : sinon l'ancien écran saute.
  useLayoutEffect(() => window.scrollTo(0, 0), [nav.view, nav.tab])

  if (!ready) return null
  const v = nav.view

  let screen
  if (v?.type === 'muscle') screen = <MuscleView id={v.id} />
  else if (v?.type === 'exercise') screen = <ExerciseDetail id={v.id} />
  else if (v?.type === 'notes') screen = <NotesImport />
  else screen = <Muscles />

  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        {screen}
      </div>
    </NavContext.Provider>
  )
}
