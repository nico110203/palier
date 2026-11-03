import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { duration, shortDate } from '../format'
import { useNav } from '../nav'
import { startSession } from '../session'
import { Icon, ScreenHead } from '../components/ui'

export function Home() {
  const nav = useNav()
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray()) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray()) ?? []
  const active = sessions.find((s) => s.endedAt == null)
  const exName = new Map(exercises.map((e) => [e.id!, e.name]))

  const lastFor = (templateName: string) => sessions.find((s) => s.endedAt != null && s.name === templateName)

  const start = async (name: string, templateId?: number) => {
    const tpl = templates.find((t) => t.id === templateId)
    const id = await startSession(name, tpl?.slots ?? [], templateId)
    nav.open({ type: 'workout', sessionId: id })
  }

  return (
    <main className="screen">
      <ScreenHead title="Séance" />

      {active && (
        <button className="card card-button" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', marginBottom: 'var(--space-6)' }} onClick={() => nav.open({ type: 'workout', sessionId: active.id! })}>
          <span className="label">En cours · {duration(Date.now() - active.startedAt)}</span>
          <div className="row">
            <span className="title-md grow">{active.name}</span>
            <span className="btn btn-primary">Reprendre</span>
          </div>
        </button>
      )}

      <div className="section" style={{ marginTop: 0 }}>
        <span className="label">Modèles</span>
        <div className="stack">
          {templates.map((t) => {
            const last = lastFor(t.name)
            const names = t.slots.filter((s) => !s.hidden).map((s) => exName.get(s.exerciseId)).filter(Boolean)
            return (
              <button key={t.id} className="card card-button" disabled={!!active} onClick={() => start(t.name, t.id)} aria-label={`Commencer la séance ${t.name}`}>
                <div className="row">
                  <span className="title-md grow">{t.name}</span>
                  <span className="caption">{last ? shortDate(last.startedAt) : 'Jamais faite'}</span>
                </div>
                <p className="caption" style={{ margin: 'var(--space-1) 0 0' }}>
                  {names.length} exercice{names.length > 1 ? 's' : ''} · {names.slice(0, 3).join(', ')}
                  {names.length > 3 ? '…' : ''}
                </p>
              </button>
            )
          })}
          <button className="btn btn-lg" disabled={!!active} onClick={() => start('Séance libre')}>
            <Icon name="plus" /> Séance libre
          </button>
        </div>
      </div>
    </main>
  )
}
