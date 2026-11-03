import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, moveMuscle } from '../db'
import { useNav } from '../nav'
import { Icon, ScreenHead, Sheet, useLongPress } from '../components/ui'
import { MuscleIcon } from '../components/MuscleIcon'

export function Muscles() {
  const nav = useNav()
  const loaded = useLiveQuery(() => db.templates.orderBy('order').toArray())
  const muscles = loaded ?? []
  const [ordering, setOrdering] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const press = useLongPress(() => setOrdering(true))
  const create = async () => {
    const clean = name.trim().toUpperCase()
    if (!clean) return
    const id = (await db.templates.add({ name: clean, order: muscles.length, slots: [] })) as number
    setAdding(false)
    setName('')
    nav.open({ type: 'muscle', id })
  }

  // Rien tant que la base n'a pas répondu : évite le flash de l'état vide.
  if (!loaded) return null

  if (ordering) {
    return (
      <main className="screen">
        <ScreenHead title="Ordre">
          <button className="btn btn-primary" onClick={() => setOrdering(false)}>
            OK
          </button>
        </ScreenHead>
        <p className="caption hint">Monte ou descends les muscles avec les flèches.</p>
        <div className="stack">
          {muscles.map((m, i) => (
            <div key={m.id} className="card row order-card">
              <span className="title-md grow">{m.name}</span>
              <button className="btn btn-ghost btn-icon" disabled={i === 0} onClick={() => moveMuscle(m.id!, -1)} aria-label={`Monter ${m.name}`}>
                <Icon name="up" />
              </button>
              <button className="btn btn-ghost btn-icon" disabled={i === muscles.length - 1} onClick={() => moveMuscle(m.id!, 1)} aria-label={`Descendre ${m.name}`}>
                <Icon name="down" />
              </button>
            </div>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="screen">
      <ScreenHead title="Tous les muscles">
        <button className="btn btn-ghost btn-icon" onClick={() => setOrdering(true)} aria-label="Changer l'ordre">
          <Icon name="list" />
        </button>
        <button className="btn btn-ghost btn-icon" onClick={() => setAdding(true)} aria-label="Ajouter un muscle">
          <Icon name="plus" />
        </button>
      </ScreenHead>

      <div className="stack">
        {muscles.map((m) => (
          <button key={m.id} className="card card-button media-row" {...press.handlers} onClick={() => !press.fired() && nav.open({ type: 'muscle', id: m.id! })}>
            <span className="thumb"><MuscleIcon name={m.name} /></span>
            <span className="media-title grow">{m.name}</span>
            <span className="media-end"><Icon name="chevron" size={20} /></span>
          </button>
        ))}
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
