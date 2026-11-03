import { useEffect, useState } from 'react'
import { db, getSetting, setSetting } from './db'
import { NavContext, useNavState, type Tab } from './nav'
import { applyNotes, INITIAL_NOTES, parseNotes } from './notes'
import { Icon } from './components/ui'
import { Muscles } from './screens/Muscles'
import { MuscleView } from './screens/Muscle'
import { ExerciseDetail, History } from './screens/History'
import { applyTheme, Manage, NotesImport, type Theme } from './screens/Manage'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'muscles', label: 'Muscles', icon: 'dumbbell' },
  { id: 'historique', label: 'Historique', icon: 'chart' },
  { id: 'exercices', label: 'Exercices', icon: 'list' },
]

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

  if (!ready) return null
  const v = nav.view

  let screen
  if (v?.type === 'muscle') screen = <MuscleView id={v.id} />
  else if (v?.type === 'exercise') screen = <ExerciseDetail id={v.id} />
  else if (v?.type === 'notes') screen = <NotesImport />
  else if (nav.tab === 'historique') screen = <History />
  else if (nav.tab === 'exercices') screen = <Manage />
  else screen = <Muscles />

  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        {screen}
        <nav className="tabs" aria-label="Navigation">
          {TABS.map((t) => (
            <button key={t.id} className="tab" aria-current={nav.tab === t.id && !v ? 'page' : undefined} onClick={() => nav.setTab(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </NavContext.Provider>
  )
}
