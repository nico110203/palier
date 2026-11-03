import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, moveMuscle } from '../db'
import { shortDate } from '../format'
import { useNav } from '../nav'
import { Icon, ScreenHead, Sheet, useLongPress } from '../components/ui'

export function Muscles() {
  const nav = useNav()
  const muscles = useLiveQuery(() => db.templates.orderBy('order').toArray()) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const lastAt = useLiveQuery(async () => {
    const map = new Map<number, number>()
    for (const l of await db.logs.toArray()) map.set(l.exerciseId, Math.max(map.get(l.exerciseId) ?? 0, l.at))
    return map
  })
  const [ordering, setOrdering] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const press = useLongPress(() => setOrdering(true))
  const exName = new Map(exercises.map((e) => [e.id!, e.name]))

  const create = async () => {
    const clean = name.trim().toUpperCase()
    if (!clean) return
    const id = (await db.templates.add({ name: clean, order: muscles.length, slots: [] })) as number
    setAdding(false)
    setName('')
    nav.open({ type: 'muscle', id })
  }

  return (
    <main className="screen">
      <ScreenHead title="Muscles">
        {ordering ? (
          <button className="btn btn-primary" onClick={() => setOrdering(false)}>
            OK
          </button>
        ) : (
          <>
            <button className="btn btn-ghost btn-icon" onClick={() => setAdding(true)} aria-label="Ajouter un muscle">
              <Icon name="plus" />
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => setOrdering(true)} aria-label="Changer l'ordre des muscles">
              <Icon name="more" />
            </button>
          </>
        )}
      </ScreenHead>
      {ordering && <p className="caption hint">Monte ou descends les muscles avec les flèches.</p>}

      <div className="stack">
        {muscles.map((m, i) => {
          const visible = m.slots.filter((s) => !s.hidden)
          const names = visible.map((s) => exName.get(s.exerciseId)).filter(Boolean)
          const last = Math.max(0, ...visible.map((s) => lastAt?.get(s.exerciseId) ?? 0))
          if (ordering) {
            return (
              <div key={m.id} className="card row order-card">
                <span className="title-md grow">{m.name}</span>
                <button className="btn btn-ghost btn-icon" disabled={i === 0} onClick={() => moveMuscle(m.id!, -1)} aria-label={`Monter ${m.name}`}>
                  <Icon name="up" />
                </button>
                <button className="btn btn-ghost btn-icon" disabled={i === muscles.length - 1} onClick={() => moveMuscle(m.id!, 1)} aria-label={`Descendre ${m.name}`}>
                  <Icon name="down" />
                </button>
              </div>
            )
          }
          return (
            <button key={m.id} className="card card-button" {...press.handlers} onClick={() => !press.fired() && nav.open({ type: 'muscle', id: m.id! })}>
              <div className="row">
                <span className="title-md grow">{m.name}</span>
                <span className="caption">{last ? shortDate(last) : ''}</span>
              </div>
              <p className="caption" style={{ margin: 'var(--space-1) 0 0' }}>
                {names.length} exercice{names.length > 1 ? 's' : ''}
                {names.length ? ` · ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}` : ''}
              </p>
            </button>
          )
        })}
      </div>

      {adding && (
        <Sheet title="Nouveau muscle" onClose={() => setAdding(false)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              create()
            }}
          >
            <input className="input" placeholder="ex. JAMBES" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Nom du muscle" />
            <button className="btn btn-lg btn-primary" disabled={!name.trim()}>
              Ajouter le muscle
            </button>
          </form>
        </Sheet>
      )}
    </main>
  )
}
