import { useEffect, useState } from 'react'
import { db, getSetting, setSetting } from './db'
import { NavContext, useNavState, type Tab } from './nav'
import { applyNotes, INITIAL_NOTES, parseNotes } from './notes'
import { RestTimer } from './components/RestTimer'
import { Icon } from './components/ui'
import { Home } from './screens/Home'
import { Workout } from './screens/Workout'
import { ExerciseDetail, History, SessionDetail } from './screens/History'
import { applyTheme, Manage, NotesImport, TemplateEditor, type Theme } from './screens/Manage'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'seance', label: 'Séance', icon: 'dumbbell' },
  { id: 'historique', label: 'Historique', icon: 'chart' },
  { id: 'exercices', label: 'Exercices', icon: 'list' },
]

/** Premier lancement : reprend les notes du bloc-notes. Mémorisé pour le double effet de StrictMode. */
let seeding: Promise<void> | null = null
function seedOnce() {
  seeding ??= (async () => {
    if (await getSetting('seeded', false)) return
    if (!(await db.exercises.count())) await applyNotes(parseNotes(INITIAL_NOTES))
    await setSetting('seeded', true)
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
  if (v?.type === 'workout') screen = <Workout sessionId={v.sessionId} />
  else if (v?.type === 'exercise') screen = <ExerciseDetail id={v.id} />
  else if (v?.type === 'session') screen = <SessionDetail id={v.id} />
  else if (v?.type === 'template') screen = <TemplateEditor id={v.id} />
  else if (v?.type === 'notes') screen = <NotesImport />
  else if (nav.tab === 'historique') screen = <History />
  else if (nav.tab === 'exercices') screen = <Manage />
  else screen = <Home />

  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        {screen}
        <RestTimer />
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
