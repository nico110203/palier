import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, moveMuscle } from '../db'
import { shortDate } from '../format'
import { useNav } from '../nav'
import { Icon, ScreenHead, Sheet, useLongPress } from '../components/ui'

const DAY = 86400000

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'Bonsoir' : h < 18 ? 'Salut' : 'Bonsoir'
}

function sinceLabel(ts: number) {
  if (!ts) return '—'
  const d = Math.floor((Date.now() - ts) / DAY)
  return d <= 0 ? "Auj." : `${d}`
}

export function Muscles() {
  const nav = useNav()
  const muscles = useLiveQuery(() => db.templates.orderBy('order').toArray()) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const logs = useLiveQuery(() => db.logs.toArray()) ?? []
  const [ordering, setOrdering] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const press = useLongPress(() => setOrdering(true))
  const exName = new Map(exercises.map((e) => [e.id!, e.name]))
  const lastAt = new Map<number, number>()
  for (const l of logs) lastAt.set(l.exerciseId, Math.max(lastAt.get(l.exerciseId) ?? 0, l.at))

  const create = async () => {
    const clean = name.trim().toUpperCase()
    if (!clean) return
    const id = (await db.templates.add({ name: clean, order: muscles.length, slots: [] })) as number
    setAdding(false)
    setName('')
    nav.open({ type: 'muscle', id })
  }

  const info = muscles.map((m) => {
    const visible = m.slots.filter((s) => !s.hidden)
    const names = visible.map((s) => exName.get(s.exerciseId)).filter(Boolean) as string[]
    const last = Math.max(0, ...visible.map((s) => lastAt.get(s.exerciseId) ?? 0))
    return { m, names, last }
  })
  // Muscle suggéré : celui qui n'a pas été travaillé depuis le plus longtemps.
  const next = [...info].filter((i) => i.names.length).sort((a, b) => a.last - b.last)[0]

  const weekDays = new Set(logs.filter((l) => l.at > Date.now() - 7 * DAY).map((l) => l.day)).size
  const lastSession = Math.max(0, ...logs.map((l) => l.at))
  const since = sinceLabel(lastSession)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

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
      <header className="hello">
        <span className="avatar" aria-hidden="true">
          <Icon name="dumbbell" />
        </span>
        <div className="grow">
          <div className="hello-sub">{greeting()} 👋</div>
          <div className="hello-main">Bonne séance !</div>
        </div>
        <button className="round-btn" onClick={() => setAdding(true)} aria-label="Ajouter un muscle">
          <Icon name="plus" />
        </button>
      </header>

      <p className="date-line">{today}</p>
      <h1 className="hero-title">
        Pousse plus lourd, progresse chaque jour <span className="bolt">⚡</span>
      </h1>

      <div className="tiles">
        <div className="tile">
          <span className="tile-icon"><Icon name="flame" size={28} /></span>
          <span className="tile-value">{weekDays}<small>/7</small></span>
          <span className="tile-label">Séances</span>
        </div>
        <div className="tile">
          <span className="tile-icon"><Icon name="dumbbell" size={28} /></span>
          <span className="tile-value">{exercises.filter((e) => !e.archived).length}</span>
          <span className="tile-label">Exercices</span>
        </div>
        <div className="tile">
          <span className="tile-icon"><Icon name="clock" size={28} /></span>
          <span className="tile-value">
            {since}
            {/^\d+$/.test(since) && <small>j</small>}
          </span>
          <span className="tile-label">Dernière</span>
        </div>
      </div>

      <div className="pills" role="list" aria-label="Muscles">
        {info.map(({ m }) => (
          <button key={m.id} role="listitem" className="pill" aria-current={next?.m.id === m.id ? 'true' : undefined} onClick={() => nav.open({ type: 'muscle', id: m.id! })}>
            <span className="pill-icon">{m.name.slice(0, 2)}</span>
            {m.name.charAt(0) + m.name.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {next && (
        <button className="hero-card" onClick={() => nav.open({ type: 'muscle', id: next.m.id! })}>
          <span className="hero-badge" aria-hidden="true"><Icon name="bolt" /></span>
          <svg className="hero-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.4 14.4 9.6 9.6" />
            <path d="M18.66 21.51a2 2 0 1 1-2.83-2.83l-1.77 1.77a2 2 0 1 1-2.83-2.83l6.37-6.37a2 2 0 1 1 2.83 2.83l-1.77 1.77a2 2 0 1 1 2.83 2.83z" />
            <path d="M6.4 12.77a2 2 0 1 1-2.83-2.83l1.77-1.77a2 2 0 1 1-2.83-2.83l2.83-2.83a2 2 0 1 1 2.83 2.83l1.77-1.77a2 2 0 1 1 2.83 2.83z" />
          </svg>
          <div className="hero-kicker">À faire aujourd'hui</div>
          <div className="hero-name">{next.m.name}</div>
          <div className="hero-sub">{next.names.slice(0, 3).join(' · ')}{next.names.length > 3 ? '…' : ''}</div>
          <div className="hero-meta">
            <span><Icon name="calendar" /> {next.last ? `Dernière fois ${shortDate(next.last)}` : 'Jamais fait'}</span>
            <span><Icon name="list" /> {next.names.length} exercice{next.names.length > 1 ? 's' : ''}</span>
          </div>
        </button>
      )}

      <div className="section">
        <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
          <span className="title-md grow">Tous les muscles</span>
          <button className="btn btn-ghost" style={{ minHeight: 36, padding: '0 var(--space-2)', color: 'var(--accent)' }} onClick={() => setOrdering(true)}>
            Ordre
          </button>
        </div>
        <div className="stack">
          {info.map(({ m, names, last }) => (
            <button key={m.id} className="card card-button media-row" {...press.handlers} onClick={() => !press.fired() && nav.open({ type: 'muscle', id: m.id! })}>
              <span className="thumb">{m.name.slice(0, 2)}</span>
              <span className="grow">
                <span className="media-title" style={{ display: 'block' }}>{m.name}</span>
                <span className="media-sub" style={{ display: 'block' }}>
                  {names.length} exercice{names.length > 1 ? 's' : ''}
                  {last ? ` · ${shortDate(last)}` : ''}
                  {names.length ? ` · ${names.slice(0, 3).join(', ')}` : ''}
                </span>
              </span>
              <span className="media-end"><Icon name="chevron" size={20} /></span>
            </button>
          ))}
        </div>
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
