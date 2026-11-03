import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, lastSetsFor, sortGroups, type Exercise, type SetEntry } from '../db'
import { cardioLabel, duration, num, parseNum, setLabel } from '../format'
import { useNav } from '../nav'
import { addExerciseToSession, addSet, best, deleteSession, finishSession, removeLastSet, setSlotHidden } from '../session'
import { Icon, ScreenHead, Sheet } from '../components/ui'

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

/** Champ numérique éditable sur place : chaque frappe est enregistrée. */
function NumField({ value, label, unit, onSave, decimal = true, pr = false }: { value: number; label: string; unit?: string; onSave: (n: number) => void; decimal?: boolean; pr?: boolean }) {
  const [draft, setDraft] = useState(num(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(num(value))
  }, [value])
  return (
    <label className={`num-field${pr ? ' is-pr' : ''}`}>
      <input
        className="numeral-sm"
        inputMode={decimal ? 'decimal' : 'numeric'}
        aria-label={label}
        value={draft}
        onFocus={(e) => {
          focused.current = true
          e.currentTarget.select()
        }}
        onBlur={() => {
          focused.current = false
          setDraft(num(value))
        }}
        onChange={(e) => {
          const v = e.currentTarget.value.replace(/[^\d.,]/g, '')
          setDraft(v)
          onSave(decimal ? parseNum(v) : Math.round(parseNum(v)))
        }}
      />
      {unit && <span className="num-unit">{unit}</span>}
    </label>
  )
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
    const ended = new Set((await db.sessions.filter((s) => s.endedAt != null).toArray()).map((s) => s.id))
    for (const slot of session.slots) {
      const all = await lastSetsFor(slot.exerciseId, sessionId)
      const occ = seen.get(slot.exerciseId) ?? 0
      seen.set(slot.exerciseId, occ + 1)
      const slots = [...new Set(all.map((s) => s.slot))].sort((a, b) => a - b)
      last.push(all.filter((s) => s.slot === (slots[occ] ?? slots[slots.length - 1])))
      if (!prs.has(slot.exerciseId)) {
        const past = await db.sets.where('exerciseId').equals(slot.exerciseId).filter((s) => ended.has(s.sessionId) && s.sessionId !== sessionId).toArray()
        prs.set(slot.exerciseId, best(past))
      }
    }
    return { last, prs }
  }, [sessionId, slotKey])

  const [editMode, setEditMode] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)

  if (!session) return null
  const hiddenCount = session.slots.filter((s) => s.hidden).length
  const save = (row: SetEntry, patch: Partial<SetEntry>) => db.sets.update(row.id!, patch)

  const finish = async () => {
    await finishSession(sessionId)
    nav.back()
  }

  return (
    <main className="screen">
      <ScreenHead title={session.name} onBack={nav.back}>
        {editMode ? (
          <button className="btn btn-primary" onClick={() => setEditMode(false)}>
            OK
          </button>
        ) : (
          <>
            <button className="btn btn-ghost btn-icon" onClick={() => setPicking(true)} aria-label="Ajouter un exercice">
              <Icon name="plus" />
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => setEditMode(true)} aria-label="Masquer ou afficher des exercices">
              <Icon name="more" />
            </button>
          </>
        )}
      </ScreenHead>

      {editMode && <p className="caption" style={{ marginTop: 'calc(-1 * var(--space-4))' }}>Coche les exercices à masquer. Ils restent masqués pour les prochaines séances.</p>}

      <div className="stack">
        {session.slots.map((slot, i) => {
          const ex = exById.get(slot.exerciseId)
          if (!ex || (slot.hidden && !editMode)) return null
          const rows = sets.filter((s) => s.slot === i).sort((a, b) => a.index - b.index)
          const last = history?.last[i] ?? []
          const pr = history?.prs.get(ex.id!)
          const cardio = ex.kind === 'cardio'

          if (editMode) {
            return (
              <label key={i} className={`card toggle-row${slot.hidden ? ' is-hidden' : ''}`}>
                <span className="grow">
                  <span className="title-md" style={{ display: 'block' }}>{ex.name}</span>
                  {ex.detail && <span className="caption">{ex.detail}</span>}
                </span>
                <span className="caption">Masquer</span>
                <input type="checkbox" checked={!!slot.hidden} onChange={(e) => setSlotHidden(sessionId, i, e.target.checked)} />
              </label>
            )
          }

          return (
            <section key={i} className="card exo" aria-label={ex.name}>
              <button className="exo-name" onClick={() => nav.open({ type: 'exercise', id: ex.id! })}>
                {slot.superset && (
                  <span className="label superset-tag">
                    <Icon name="link" size={16} /> Enchaîné
                  </span>
                )}
                <span className="title-md" style={{ display: 'block' }}>{ex.name}</span>
                {ex.detail && <span className="exo-detail">{ex.detail}</span>}
                <span className="caption" style={{ display: 'block', marginTop: 'var(--space-1)' }}>
                  {last.length ? `Dernière fois ${last.map((s) => (cardio ? cardioLabel(s) : `${num(s.kg)} × ${s.reps}`)).join(', ')}` : 'Première fois'}
                </span>
                {pr && !cardio && <span className="caption" style={{ display: 'block' }}>PR {setLabel(pr.kg, pr.reps)}{ex.perSide ? ' par côté' : ''}</span>}
              </button>

              <div className="exo-sets">
                {rows.map((row) => (
                  <div key={row.id} className="set-fields">
                    {cardio ? (
                      <>
                        <NumField value={row.speed ?? 0} unit="km/h" label={`Série ${row.index + 1}, vitesse`} onSave={(v) => save(row, { speed: v })} />
                        <NumField value={row.minutes ?? 0} unit="min" label={`Série ${row.index + 1}, durée`} onSave={(v) => save(row, { minutes: v })} />
                      </>
                    ) : (
                      <>
                        <NumField value={row.reps} unit="reps" decimal={false} label={`Série ${row.index + 1}, répétitions`} onSave={(v) => save(row, { reps: v })} />
                        <span className="times" aria-hidden="true">×</span>
                        <NumField value={row.kg} unit={pr && row.kg > pr.kg ? 'kg · PR' : 'kg'} pr={!!pr && row.kg > pr.kg} label={`Série ${row.index + 1}, charge en kg`} onSave={(v) => save(row, { kg: v })} />
                      </>
                    )}
                  </div>
                ))}
                {!cardio && (
                  <div className="set-actions">
                    <button className="btn btn-ghost btn-icon" onClick={() => removeLastSet(sessionId, i)} disabled={rows.length <= 1} aria-label="Retirer une série">
                      <Icon name="minus" size={20} />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={() => addSet(sessionId, ex.id!, i)} aria-label="Ajouter une série">
                      <Icon name="plus" size={20} />
                    </button>
                  </div>
                )}
              </div>
            </section>
          )
        })}

        {!editMode && hiddenCount > 0 && (
          <button className="btn btn-ghost" onClick={() => setEditMode(true)}>
            {hiddenCount} exercice{hiddenCount > 1 ? 's' : ''} masqué{hiddenCount > 1 ? 's' : ''}, afficher
          </button>
        )}

        {!editMode && (
          <>
            <button className="btn btn-lg btn-primary" onClick={finish}>
              Terminer la séance
            </button>
            <p className="caption" style={{ textAlign: 'center', margin: 0 }}>
              Enregistré à chaque modification · {duration(Date.now() - session.startedAt)}
            </p>
            <button className="btn btn-ghost" onClick={() => setConfirmQuit(true)}>
              Abandonner la séance
            </button>
          </>
        )}
      </div>

      {picking && (
        <ExercisePicker
          exercises={exercises}
          group={session.name}
          exclude={session.slots.filter((s) => !s.hidden).map((s) => s.exerciseId)}
          onPick={async (id) => {
            setPicking(false)
            const hiddenSlot = session.slots.findIndex((s) => s.exerciseId === id && s.hidden)
            if (hiddenSlot >= 0) await setSlotHidden(sessionId, hiddenSlot, false)
            else await addExerciseToSession(sessionId, id)
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

/** Choisir un exercice existant (celui du groupe en premier) ou en créer un nouveau. */
export function ExercisePicker({
  exercises,
  group,
  exclude = [],
  onPick,
  onClose,
}: {
  exercises: Exercise[]
  group?: string
  exclude?: number[]
  onPick: (id: number) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const active = exercises.filter((e) => !e.archived && !exclude.includes(e.id!))
  const groups = sortGroups([...new Set(active.map((e) => e.group))]).sort((a, b) => (a === group ? -1 : b === group ? 1 : 0))
  const known = new Set(exercises.map((e) => e.group))

  const create = async () => {
    const clean = name.trim()
    if (!clean) return
    const g = group && known.has(group) ? group : 'AUTRES'
    const id = (await db.exercises.add({ name: clean, group: g, kind: 'strength', perSide: false, step: 2.5, rest: 0 })) as number
    onPick(id)
  }

  return (
    <Sheet title="Ajouter un exercice" onClose={onClose}>
      <form
        className="row"
        style={{ marginBottom: 'var(--space-6)' }}
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <input className="input grow" placeholder="Nouvel exercice" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom du nouvel exercice" />
        <button className="btn btn-primary" disabled={!name.trim()}>
          Créer
        </button>
      </form>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 'var(--space-6)' }}>
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
