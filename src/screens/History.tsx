import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, sortGroups, type SetEntry } from '../db'
import { cardioLabel, duration, kg, num, setLabel, shortDate } from '../format'
import { useNav } from '../nav'
import { best, deleteSession, volume } from '../session'
import { Chart } from '../components/Chart'
import { Icon, ScreenHead, Sheet } from '../components/ui'

function useFinished() {
  return useLiveQuery(async () => {
    const sessions = await db.sessions.filter((s) => s.endedAt != null).toArray()
    const ids = new Set(sessions.map((s) => s.id))
    const sets = await db.sets.filter((s) => ids.has(s.sessionId) && s.done).toArray()
    return { sessions: sessions.sort((a, b) => b.startedAt - a.startedAt), sets }
  })
}

export function History() {
  const nav = useNav()
  const [mode, setMode] = useState<'sessions' | 'exercises'>('sessions')
  const data = useFinished()
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const exById = new Map(exercises.map((e) => [e.id!, e]))
  if (!data) return null

  return (
    <main className="screen">
      <ScreenHead title="Historique" />
      <div className="chips" role="group" aria-label="Affichage">
        <button className="chip" aria-pressed={mode === 'sessions'} onClick={() => setMode('sessions')}>
          Séances
        </button>
        <button className="chip" aria-pressed={mode === 'exercises'} onClick={() => setMode('exercises')}>
          Exercices
        </button>
      </div>

      {mode === 'sessions' ? (
        <div className="stack section" style={{ marginTop: 'var(--space-6)' }}>
          {!data.sessions.length && <p className="empty">Aucune séance terminée pour l'instant.</p>}
          {data.sessions.map((s) => {
            const sets = data.sets.filter((x) => x.sessionId === s.id)
            const vol = sets.reduce((v, x) => v + x.kg * x.reps * (exById.get(x.exerciseId)?.perSide ? 2 : 1), 0)
            return (
              <button key={s.id} className="card card-button" onClick={() => nav.open({ type: 'session', id: s.id! })}>
                <div className="row">
                  <span className="title-md grow">{s.name}</span>
                  <span className="caption">{shortDate(s.startedAt)}</span>
                </div>
                <p className="caption" style={{ margin: 'var(--space-1) 0 0' }}>
                  {sets.length} série{sets.length > 1 ? 's' : ''}
                  {vol ? ` · ${kg(vol)}` : ''}
                  {s.endedAt! > s.startedAt ? ` · ${duration(s.endedAt! - s.startedAt)}` : ''}
                </p>
              </button>
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
                  const b = best(data.sets.filter((x) => x.exerciseId === e.id))
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
  const data = useFinished()
  if (!ex || !data) return null

  const sets = data.sets.filter((s) => s.exerciseId === id)
  const bySession = new Map<number, SetEntry[]>()
  for (const s of sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s])
  const rows = [...bySession.entries()].map(([sid, list]) => ({ sid, at: list[0].at, list: list.sort((a, b) => a.slot - b.slot || a.index - b.index) })).sort((a, b) => a.at - b.at)
  const cardio = ex.kind === 'cardio'
  const points = rows.map((r) => ({ at: r.at, value: cardio ? Math.max(...r.list.map((s) => s.speed ?? 0)) : best(r.list)!.kg }))
  const pr = best(sets)
  const lastRow = rows[rows.length - 1]

  return (
    <main className="screen">
      <ScreenHead title={ex.name} onBack={nav.back} />
      {!rows.length ? (
        <p className="empty">Pas encore de séance pour cet exercice.</p>
      ) : (
        <>
          {cardio ? (
            <div>
              <span className="label">Vitesse max</span>
              <div className="numeral-xl">{num(Math.max(...points.map((p) => p.value)))}&nbsp;km/h</div>
            </div>
          ) : (
            pr && (
              <div>
                <span className="badge badge-pr">PR</span>
                <div className="numeral-xl" style={{ marginTop: 'var(--space-2)' }}>
                  {kg(pr.kg)}
                </div>
                <span className="caption">
                  × {pr.reps} répétitions{ex.perSide ? ' · par côté' : ''}
                </span>
              </div>
            )
          )}

          <div className="stats section" style={{ marginTop: 'var(--space-6)' }}>
            <div className="stat">
              <div className="label">Séances</div>
              <div className="numeral-md">{rows.length}</div>
            </div>
            <div className="stat">
              <div className="label">Dernière</div>
              <div className="numeral-md">{shortDate(lastRow.at)}</div>
            </div>
            <div className="stat">
              <div className="label">{cardio ? 'Durée' : 'Volume'}</div>
              <div className="numeral-md">{cardio ? `${num(lastRow.list[0].minutes ?? 0)} min` : kg(volume(lastRow.list, ex.perSide))}</div>
            </div>
          </div>

          <div className="section">
            <span className="label">{cardio ? 'Vitesse par séance' : 'Meilleure série par séance'}</span>
            <div className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
              <Chart points={points} unit={cardio ? 'km/h' : 'kg'} />
            </div>
          </div>

          <div className="section">
            <span className="label">Séances</span>
            <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
              {[...rows].reverse().map((r) => (
                <div key={r.sid} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <span className="caption" style={{ width: 64, flex: 'none', paddingTop: 2 }}>
                    {shortDate(r.at)}
                  </span>
                  <span className="grow numeral-sm">
                    {r.list.map((s) => (cardio ? cardioLabel(s) : setLabel(s.kg, s.reps))).join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  )
}

export function SessionDetail({ id }: { id: number }) {
  const nav = useNav()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(id).toArray(), [id]) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const [confirm, setConfirm] = useState(false)
  if (!session) return null
  const exById = new Map(exercises.map((e) => [e.id!, e]))
  const slots = [...new Set(sets.map((s) => s.slot))].sort((a, b) => a - b)

  return (
    <main className="screen">
      <ScreenHead title={session.name} onBack={nav.back} />
      <p className="caption" style={{ marginTop: 'calc(-1 * var(--space-4))' }}>
        {shortDate(session.startedAt)}
        {session.endedAt! > session.startedAt ? ` · ${duration(session.endedAt! - session.startedAt)}` : ''}
      </p>
      <div className="stack section" style={{ marginTop: 'var(--space-6)' }}>
        {slots.map((slot) => {
          const list = sets.filter((s) => s.slot === slot).sort((a, b) => a.index - b.index)
          const ex = exById.get(list[0].exerciseId)
          if (!ex) return null
          return (
            <button key={slot} className="card card-button" onClick={() => nav.open({ type: 'exercise', id: ex.id! })}>
              <span className="title-md">{ex.name}</span>
              <div className="stack-sm" style={{ marginTop: 'var(--space-2)' }}>
                {list.map((s) => (
                  <div key={s.id} className="row">
                    <span className="label set-num">{s.index + 1}</span>
                    <span className="numeral-sm">{ex.kind === 'cardio' ? cardioLabel(s) : setLabel(s.kg, s.reps)}</span>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
        <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirm(true)}>
          <Icon name="trash" /> Supprimer la séance
        </button>
      </div>
      {confirm && (
        <Sheet title="Supprimer la séance" onClose={() => setConfirm(false)}>
          <p style={{ marginTop: 0 }}>Cette séance et ses séries seront supprimées de l'historique.</p>
          <div className="stack-sm">
            <button
              className="btn btn-lg btn-danger"
              onClick={async () => {
                await deleteSession(id)
                nav.back()
              }}
            >
              Supprimer
            </button>
            <button className="btn btn-lg" onClick={() => setConfirm(false)}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}
