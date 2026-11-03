import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, sortGroups, type Log } from '../db'
import { cardioLabel, kg, num, setLabel, shortDate } from '../format'
import { useNav } from '../nav'
import { Chart } from '../components/Chart'
import { Icon, ScreenHead, Sheet } from '../components/ui'

function bestOf(logs: Log[]) {
  let b: { kg: number; reps: number } | null = null
  for (const l of logs) if (!b || l.kg > b.kg || (l.kg === b.kg && l.reps > b.reps)) b = { kg: l.kg, reps: l.reps }
  return b
}

export function History() {
  const nav = useNav()
  const [mode, setMode] = useState<'journal' | 'exercises'>('journal')
  const logs = useLiveQuery(() => db.logs.orderBy('at').reverse().toArray()) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const exById = new Map(exercises.map((e) => [e.id!, e]))

  const days = [...new Set(logs.map((l) => l.day))]

  return (
    <main className="screen">
      <ScreenHead title="Historique" />
      <div className="segmented" role="group" aria-label="Affichage">
        <button className="chip" aria-pressed={mode === 'journal'} onClick={() => setMode('journal')}>
          Par jour
        </button>
        <button className="chip" aria-pressed={mode === 'exercises'} onClick={() => setMode('exercises')}>
          Par exercice
        </button>
      </div>

      {mode === 'journal' ? (
        <div className="stack section" style={{ marginTop: 'var(--space-6)' }}>
          {!days.length && <p className="empty">Rien d'enregistré pour l'instant.</p>}
          {days.map((d) => {
            const list = logs.filter((l) => l.day === d)
            return (
              <div key={d} className="card">
                <span className="label">{shortDate(list[0].at)}</span>
                <div style={{ marginTop: 'var(--space-2)' }}>
                  {list.map((l) => {
                    const ex = exById.get(l.exerciseId)
                    if (!ex) return null
                    return (
                      <button key={l.id} className="list-item" onClick={() => nav.open({ type: 'exercise', id: ex.id! })}>
                        <span className="grow">{ex.name}</span>
                        <span className="numeral-sm">{ex.kind === 'cardio' ? cardioLabel(l) : setLabel(l.kg, l.reps)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        sortGroups([...new Set(exercises.filter((e) => !e.archived).map((e) => e.group))]).map((g) => (
          <div key={g} className="section">
            <span className="label">{g}</span>
            <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
              {exercises
                .filter((e) => e.group === g && !e.archived)
                .map((e) => {
                  const b = bestOf(logs.filter((l) => l.exerciseId === e.id))
                  return (
                    <button key={e.id} className="list-item" onClick={() => nav.open({ type: 'exercise', id: e.id! })}>
                      <span className="grow">{e.name}</span>
                      {e.kind === 'strength' && b && <span className="numeral-sm">{kg(b.kg)}</span>}
                      <Icon name="chevron" />
                    </button>
                  )
                })}
            </div>
          </div>
        ))
      )}
    </main>
  )
}

export function ExerciseDetail({ id }: { id: number }) {
  const nav = useNav()
  const ex = useLiveQuery(() => db.exercises.get(id), [id])
  const logs = useLiveQuery(() => db.logs.where('exerciseId').equals(id).sortBy('at'), [id])
  const [removing, setRemoving] = useState<Log | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  if (!ex || !logs) return null
  const rename = async () => {
    const clean = renaming?.trim()
    if (clean) await db.exercises.update(id, { name: clean })
    setRenaming(null)
  }

  const cardio = ex.kind === 'cardio'
  const points = logs.map((l) => ({ at: l.at, value: cardio ? l.speed ?? 0 : l.kg }))
  const pr = bestOf(logs)
  const last = logs[logs.length - 1]

  return (
    <main className="screen">
      <ScreenHead title={ex.name} onBack={nav.back}>
        <button className="btn btn-ghost btn-icon" onClick={() => setRenaming(ex.name)} aria-label="Renommer l'exercice">
          <Icon name="pencil" />
        </button>
      </ScreenHead>
      {!logs.length ? (
        <p className="empty">Pas encore de valeur pour cet exercice.</p>
      ) : (
        <>
          {cardio ? (
            <div className="pr-card">
              <span className="badge badge-pr">VITESSE MAX</span>
              <div className="numeral-xl" style={{ marginTop: 'var(--space-2)' }}>{num(Math.max(...points.map((p) => p.value)))}&nbsp;km/h</div>
            </div>
          ) : (
            pr && (
              <div className="pr-card">
                <span className="badge badge-pr">RECORD</span>
                <div className="numeral-xl" style={{ marginTop: 'var(--space-2)' }}>
                  {kg(pr.kg)}
                </div>
                <span className="caption">
                  × {pr.reps} répétitions{ex.perSide ? ' · par côté' : ''}
                </span>
                <div className="pr-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.round((last.kg / (pr.kg || 1)) * 100))}%` }} />
                </div>
                <div className="row caption" style={{ marginTop: 'var(--space-2)' }}>
                  <span className="grow">Dernière : {kg(last.kg)}</span>
                  <span>{Math.round((last.kg / (pr.kg || 1)) * 100)} %</span>
                </div>
              </div>
            )
          )}

          <div className="stats section" style={{ marginTop: 'var(--space-6)' }}>
            <div className="stat">
              <div className="label">Jours</div>
              <div className="numeral-md">{logs.length}</div>
            </div>
            <div className="stat">
              <div className="label">Dernière</div>
              <div className="numeral-md">{shortDate(last.at)}</div>
            </div>
            <div className="stat">
              <div className="label">Progrès</div>
              <div className="numeral-md">
                {cardio ? `${num((last.speed ?? 0) - (logs[0].speed ?? 0))}` : `${(last.kg - logs[0].kg) >= 0 ? '+' : '−'}${num(Math.abs(last.kg - logs[0].kg))}`}
              </div>
            </div>
          </div>

          <div className="section">
            <span className="label">{cardio ? 'Vitesse par jour' : 'Charge par jour'}</span>
            <div className="card">
              <Chart points={points} unit={cardio ? 'km/h' : 'kg'} />
            </div>
          </div>

          <div className="section">
            <span className="label">Valeurs</span>
            <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
              {[...logs].reverse().map((l) => (
                <div key={l.id} className="list-item">
                  <span className="caption" style={{ width: 64, flex: 'none' }}>
                    {shortDate(l.at)}
                  </span>
                  <span className="grow numeral-sm">{cardio ? cardioLabel(l) : setLabel(l.kg, l.reps)}</span>
                  <button className="btn btn-ghost btn-icon" onClick={() => setRemoving(l)} aria-label={`Supprimer la valeur du ${shortDate(l.at)}`}>
                    <Icon name="trash" size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {renaming !== null && (
        <Sheet title="Renommer l'exercice" onClose={() => setRenaming(null)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              rename()
            }}
          >
            <input className="input" value={renaming} onChange={(e) => setRenaming(e.target.value)} onFocus={(e) => e.currentTarget.select()} autoFocus aria-label="Nom de l'exercice" />
            <button className="btn btn-lg btn-primary" disabled={!renaming.trim()}>
              Enregistrer
            </button>
          </form>
        </Sheet>
      )}
      {removing && (
        <Sheet title="Supprimer cette valeur" onClose={() => setRemoving(null)}>
          <p style={{ marginTop: 0 }}>
            {shortDate(removing.at)} · {cardio ? cardioLabel(removing) : setLabel(removing.kg, removing.reps)}
          </p>
          <div className="stack-sm">
            <button
              className="btn btn-lg btn-danger"
              onClick={async () => {
                await db.logs.delete(removing.id!)
                setRemoving(null)
              }}
            >
              Supprimer
            </button>
            <button className="btn btn-lg" onClick={() => setRemoving(null)}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}
