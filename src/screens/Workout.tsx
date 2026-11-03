import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, lastSetsFor, sortGroups, type Exercise, type SetEntry } from '../db'
import { cardioLabel, duration, num, setLabel } from '../format'
import { useNav } from '../nav'
import { addExerciseToSession, addSet, best, deleteSession, finishSession } from '../session'
import { DeltaBadge, Icon, ScreenHead, Sheet, Stepper } from '../components/ui'

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const take = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch {
        /* refusé : sans conséquence */
      }
    }
    take()
    const onVis = () => document.visibilityState === 'visible' && take()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release()
    }
  }, [])
}

export function Workout({ sessionId }: { sessionId: number }) {
  const nav = useNav()
  useWakeLock()
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).toArray(), [sessionId]) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const exById = new Map(exercises.map((e) => [e.id!, e]))
  const slotKey = session?.slots.map((s) => s.exerciseId).join(',')

  // Dernière fois + record par emplacement, calculés hors de la séance en cours.
  const history = useLiveQuery(async () => {
    if (!session) return null
    const seen = new Map<number, number>()
    const last: SetEntry[][] = []
    const prs = new Map<number, { kg: number; reps: number } | null>()
    for (const slot of session.slots) {
      const all = await lastSetsFor(slot.exerciseId, sessionId)
      const occ = seen.get(slot.exerciseId) ?? 0
      seen.set(slot.exerciseId, occ + 1)
      const slots = [...new Set(all.map((s) => s.slot))].sort((a, b) => a - b)
      last.push(all.filter((s) => s.slot === (slots[occ] ?? slots[slots.length - 1])))
      if (!prs.has(slot.exerciseId)) {
        const ended = new Set((await db.sessions.filter((s) => s.endedAt != null).toArray()).map((s) => s.id))
        const past = await db.sets.where('exerciseId').equals(slot.exerciseId).filter((s) => ended.has(s.sessionId) && s.sessionId !== sessionId).toArray()
        prs.set(slot.exerciseId, best(past))
      }
    }
    return { last, prs }
  }, [sessionId, slotKey])

  const [editing, setEditing] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!session) return null
  const doneCount = sets.filter((s) => s.done).length
  const editRow = sets.find((s) => s.id === editing)

  const toggle = async (row: SetEntry, slot: number) => {
    const done = !row.done
    await db.sets.update(row.id!, { done })
    const ex = exById.get(row.exerciseId)
    if (!done || !ex || ex.kind === 'cardio') return
    const nextLinked = session.slots[slot + 1]?.superset
    if (nextLinked) nav.stopRest()
    else nav.startRest(ex.rest)
  }

  const finish = async () => {
    nav.stopRest()
    await finishSession(sessionId)
    nav.back()
  }

  return (
    <main className="screen">
      <ScreenHead title={session.name} onBack={nav.back}>
        <span className="caption">{duration(Date.now() - session.startedAt)}</span>
      </ScreenHead>

      <div className="stack">
        {session.slots.map((slot, i) => {
          const ex = exById.get(slot.exerciseId)
          if (!ex) return null
          const rows = sets.filter((s) => s.slot === i).sort((a, b) => a.index - b.index)
          const last = history?.last[i] ?? []
          const pr = history?.prs.get(ex.id!)
          return (
            <section key={i} className="card" aria-label={ex.name}>
              <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
                <button className="grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => nav.open({ type: 'exercise', id: ex.id! })}>
                  {slot.superset && (
                    <span className="label superset-tag">
                      <Icon name="link" size={16} /> Enchaîné
                    </span>
                  )}
                  <h2 className="title-md">{ex.name}</h2>
                  <span className="caption">
                    {ex.perSide ? 'Par côté · ' : ''}
                    {pr ? `PR ${setLabel(pr.kg, pr.reps)}` : ex.kind === 'cardio' ? 'Cardio' : 'Pas encore de record'}
                  </span>
                </button>
              </div>
              <div className="stack-sm">
                {rows.map((row) => {
                  const prev = last[row.index]
                  const isPr = ex.kind === 'strength' && row.done && pr != null && row.kg > pr.kg
                  return (
                    <div key={row.id} className={`set-row${row.done ? ' done' : ''}`}>
                      <button className="set-main" onClick={() => setEditing(row.id!)} aria-label={`Modifier la série ${row.index + 1}`}>
                        <span className="label set-num">{row.index + 1}</span>
                        <span className="grow">
                          <span className="numeral-sm" style={{ display: 'block' }}>
                            {ex.kind === 'cardio' ? cardioLabel(row) : setLabel(row.kg, row.reps)}
                          </span>
                          <span className="set-meta">
                            {prev && (
                              <span className="caption">
                                Dernière fois {ex.kind === 'cardio' ? cardioLabel(prev) : `${num(prev.kg)} × ${prev.reps}`}
                              </span>
                            )}
                            {prev && ex.kind === 'strength' && (row.kg !== prev.kg ? <DeltaBadge delta={row.kg - prev.kg} /> : row.reps !== prev.reps ? <DeltaBadge delta={row.reps - prev.reps} unit="reps" /> : <DeltaBadge delta={0} />)}
                            {isPr && <span className="badge badge-pr">PR</span>}
                          </span>
                        </span>
                      </button>
                      <button className="set-check" aria-pressed={row.done} aria-label={`Série ${row.index + 1} faite`} onClick={() => toggle(row, i)}>
                        <Icon name="check" />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 'var(--space-2)', paddingLeft: 0 }} onClick={() => addSet(sessionId, ex.id!, i)}>
                <Icon name="plus" /> Ajouter une série
              </button>
            </section>
          )
        })}

        <button className="btn btn-lg" onClick={() => setPicking(true)}>
          <Icon name="plus" /> Ajouter un exercice
        </button>
        <button className="btn btn-lg btn-primary" onClick={finish} disabled={!doneCount}>
          Terminer la séance
        </button>
        <button className="btn btn-ghost" onClick={() => setConfirmQuit(true)}>
          Abandonner la séance
        </button>
      </div>

      {editRow && exById.get(editRow.exerciseId) && (
        <SetEditor row={editRow} ex={exById.get(editRow.exerciseId)!} onClose={() => setEditing(null)} />
      )}
      {picking && (
        <ExercisePicker
          exercises={exercises}
          onPick={async (id) => {
            setPicking(false)
            await addExerciseToSession(sessionId, id)
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {confirmQuit && (
        <Sheet title="Abandonner la séance" onClose={() => setConfirmQuit(false)}>
          <p style={{ marginTop: 0 }}>Les séries de cette séance seront supprimées.</p>
          <div className="stack-sm">
            <button
              className="btn btn-lg btn-danger"
              onClick={async () => {
                nav.stopRest()
                await deleteSession(sessionId)
                nav.back()
              }}
            >
              Supprimer la séance
            </button>
            <button className="btn btn-lg" onClick={() => setConfirmQuit(false)}>
              Continuer la séance
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}

function SetEditor({ row, ex, onClose }: { row: SetEntry; ex: Exercise; onClose: () => void }) {
  const set = (patch: Partial<SetEntry>) => db.sets.update(row.id!, patch)
  return (
    <Sheet title={`${ex.name} · série ${row.index + 1}`} onClose={onClose}>
      <div className="stack">
        {ex.kind === 'cardio' ? (
          <>
            <Stepper label="Vitesse" unit="km/h" value={row.speed ?? 0} step={0.5} onChange={(v) => set({ speed: v })} />
            <Stepper label="Inclinaison" unit="%" value={row.incline ?? 0} step={1} onChange={(v) => set({ incline: v })} />
            <Stepper label="Durée" unit="min" value={row.minutes ?? 0} step={1} onChange={(v) => set({ minutes: v })} />
          </>
        ) : (
          <>
            <Stepper label={ex.perSide ? 'Charge par côté' : 'Charge'} unit="kg" value={row.kg} step={ex.step} onChange={(v) => set({ kg: v })} />
            <Stepper label="Répétitions" unit="reps" value={row.reps} step={1} onChange={(v) => set({ reps: Math.round(v) })} />
          </>
        )}
        <button className="btn btn-lg btn-primary" onClick={onClose}>
          Valider
        </button>
        <button
          className="btn btn-ghost"
          style={{ color: 'var(--danger)' }}
          onClick={async () => {
            await db.sets.delete(row.id!)
            onClose()
          }}
        >
          <Icon name="trash" /> Supprimer la série
        </button>
      </div>
    </Sheet>
  )
}

export function ExercisePicker({ exercises, onPick, onClose }: { exercises: Exercise[]; onPick: (id: number) => void; onClose: () => void }) {
  const active = exercises.filter((e) => !e.archived)
  const groups = sortGroups([...new Set(active.map((e) => e.group))])
  return (
    <Sheet title="Ajouter un exercice" onClose={onClose}>
      {groups.map((g) => (
        <div key={g} className="section" style={{ marginTop: 0, marginBottom: 'var(--space-6)' }}>
          <span className="label">{g}</span>
          {active
            .filter((e) => e.group === g)
            .map((e) => (
              <button key={e.id} className="list-item" onClick={() => onPick(e.id!)}>
                <span className="grow">{e.name}</span>
                <Icon name="plus" />
              </button>
            ))}
        </div>
      ))}
    </Sheet>
  )
}
