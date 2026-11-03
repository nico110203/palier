import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { dayKey, db, saveToday, sortGroups, type Exercise, type Log, type MuscleSlot } from '../db'
import { cardioLabel, num, parseNum, setLabel, shortDate } from '../format'
import { useNav } from '../nav'
import { Icon, ScreenHead, Sheet, useLongPress } from '../components/ui'

/** Champ numérique éditable sur place : chaque frappe est enregistrée. */
function NumField({ value, label, unit, onSave, decimal = true, pr = false }: { value: number; label: string; unit: string; onSave: (n: number) => void; decimal?: boolean; pr?: boolean }) {
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
      <span className="num-unit">{pr ? `${unit} · PR` : unit}</span>
    </label>
  )
}

interface ExState {
  current?: Log
  previous?: Log
  best?: { kg: number; reps: number }
}

function summarize(logs: Log[]): ExState {
  const today = dayKey()
  const sorted = [...logs].sort((a, b) => b.at - a.at)
  const past = sorted.filter((l) => l.day !== today)
  let best: ExState['best']
  for (const l of past) if (!best || l.kg > best.kg || (l.kg === best.kg && l.reps > best.reps)) best = { kg: l.kg, reps: l.reps }
  return { current: sorted[0], previous: past[0], best }
}

export function MuscleView({ id }: { id: number }) {
  const nav = useNav()
  const muscle = useLiveQuery(() => db.templates.get(id), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const ids = muscle?.slots.map((s) => s.exerciseId) ?? []
  const logs = useLiveQuery(() => db.logs.where('exerciseId').anyOf(ids).toArray(), [ids.join(',')]) ?? []
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const press = useLongPress(() => setEditing(true))

  if (!muscle) return null
  const exById = new Map(exercises.map((e) => [e.id!, e]))
  const slots = muscle.slots
  const saveSlots = (s: MuscleSlot[]) => db.templates.update(id, { slots: s })
  const move = (i: number, d: number) => {
    const s = [...slots]
    ;[s[i], s[i + d]] = [s[i + d], s[i]]
    saveSlots(s)
  }
  const hiddenCount = slots.filter((s) => s.hidden).length

  return (
    <main className="screen">
      <ScreenHead title={muscle.name} onBack={nav.back}>
        {editing ? (
          <button className="btn btn-primary" onClick={() => setEditing(false)}>
            OK
          </button>
        ) : (
          <>
            <button className="btn btn-ghost btn-icon" onClick={() => setPicking(true)} aria-label="Ajouter un exercice">
              <Icon name="plus" />
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => setEditing(true)} aria-label="Modifier la liste">
              <Icon name="more" />
            </button>
          </>
        )}
      </ScreenHead>

      {editing && (
        <div className="stack" style={{ marginBottom: 'var(--space-6)' }}>
          <label className="field">
            <span className="label">Nom du muscle</span>
            <input className="input" value={muscle.name} onChange={(e) => db.templates.update(id, { name: e.target.value.toUpperCase() })} />
          </label>
          <p className="caption hint" style={{ margin: 0 }}>Flèches pour changer l'ordre, case pour masquer un exercice.</p>
        </div>
      )}

      <div className="stack">
        {slots.map((slot, i) => {
          const ex = exById.get(slot.exerciseId)
          if (!ex || (slot.hidden && !editing)) return null

          if (editing) {
            return (
              <div key={slot.exerciseId} className={`card order-card${slot.hidden ? ' is-hidden' : ''}`}>
                <div className="row">
                  <span className="grow">
                    <span className="title-md" style={{ display: 'block' }}>{ex.name}</span>
                    {ex.detail && <span className="caption">{ex.detail}</span>}
                  </span>
                  <button className="btn btn-ghost btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Monter ${ex.name}`}>
                    <Icon name="up" />
                  </button>
                  <button className="btn btn-ghost btn-icon" disabled={i === slots.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre ${ex.name}`}>
                    <Icon name="down" />
                  </button>
                </div>
                <label className="toggle-row caption">
                  <span>Masquer</span>
                  <input type="checkbox" checked={!!slot.hidden} onChange={(e) => saveSlots(slots.map((s, j) => (j === i ? { ...s, hidden: e.target.checked } : s)))} />
                </label>
              </div>
            )
          }

          const st = summarize(logs.filter((l) => l.exerciseId === ex.id))
          const cur = st.current
          const cardio = ex.kind === 'cardio'
          const save = (patch: Partial<Log>) => saveToday(ex.id!, patch, cur ?? {})
          const isPr = !cardio && !!st.best && (cur?.kg ?? 0) > st.best.kg

          return (
            <section key={slot.exerciseId} className="card exo" aria-label={ex.name} {...press.handlers}>
              <button className="exo-name" onClick={() => !press.fired() && nav.open({ type: 'exercise', id: ex.id! })}>
                {slot.superset && (
                  <span className="label superset-tag">
                    <Icon name="link" size={16} /> Enchaîné
                  </span>
                )}
                <span className="title-md" style={{ display: 'block' }}>{ex.name}</span>
                {ex.detail && <span className="exo-detail">{ex.detail}</span>}
                <span className="caption" style={{ display: 'block', marginTop: 'var(--space-1)' }}>
                  {st.previous
                    ? `Dernière fois ${cardio ? cardioLabel(st.previous) : `${num(st.previous.kg)} × ${st.previous.reps}`} · ${shortDate(st.previous.at)}`
                    : 'Première fois'}
                </span>
                {st.best && !cardio && (
                  <span className="caption" style={{ display: 'block' }}>
                    PR {setLabel(st.best.kg, st.best.reps)}
                    {ex.perSide ? ' par côté' : ''}
                  </span>
                )}
              </button>

              <div className="set-fields">
                {cardio ? (
                  <>
                    <NumField value={cur?.speed ?? 0} unit="km/h" label={`${ex.name}, vitesse`} onSave={(v) => save({ speed: v })} />
                    <NumField value={cur?.minutes ?? 0} unit="min" label={`${ex.name}, durée`} onSave={(v) => save({ minutes: v })} />
                  </>
                ) : (
                  <>
                    <NumField value={cur?.reps ?? 0} unit="reps" decimal={false} label={`${ex.name}, répétitions`} onSave={(v) => save({ reps: v })} />
                    <span className="times" aria-hidden="true">×</span>
                    <NumField value={cur?.kg ?? 0} unit="kg" pr={isPr} label={`${ex.name}, charge en kg`} onSave={(v) => save({ kg: v })} />
                  </>
                )}
              </div>
            </section>
          )
        })}

        {!editing && !slots.some((s) => !s.hidden) && <p className="empty">Aucun exercice. Ajoute-en un avec le bouton +.</p>}

        {!editing && hiddenCount > 0 && (
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            {hiddenCount} exercice{hiddenCount > 1 ? 's' : ''} masqué{hiddenCount > 1 ? 's' : ''}, afficher
          </button>
        )}
        {!editing && <p className="caption" style={{ textAlign: 'center', margin: 0 }}>Enregistré à chaque modification</p>}

        {editing && (
          <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" /> Supprimer ce muscle
          </button>
        )}
      </div>

      {picking && (
        <ExercisePicker
          exercises={exercises}
          group={muscle.name}
          exclude={slots.filter((s) => !s.hidden).map((s) => s.exerciseId)}
          onPick={(eid) => {
            setPicking(false)
            const existing = slots.findIndex((s) => s.exerciseId === eid)
            if (existing >= 0) saveSlots(slots.map((s, j) => (j === existing ? { ...s, hidden: false } : s)))
            else saveSlots([...slots, { exerciseId: eid, superset: false }])
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {confirmDelete && (
        <Sheet title="Supprimer ce muscle" onClose={() => setConfirmDelete(false)}>
          <p style={{ marginTop: 0 }}>Les exercices et leur historique sont conservés.</p>
          <div className="stack-sm">
            <button
              className="btn btn-lg btn-danger"
              onClick={async () => {
                await db.templates.delete(id)
                nav.back()
              }}
            >
              Supprimer
            </button>
            <button className="btn btn-lg" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}

/** Choisir un exercice existant (ceux du muscle en premier) ou en créer un nouveau. */
function ExercisePicker({
  exercises,
  group,
  exclude,
  onPick,
  onClose,
}: {
  exercises: Exercise[]
  group: string
  exclude: number[]
  onPick: (id: number) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const active = exercises.filter((e) => !e.archived && !exclude.includes(e.id!))
  const groups = sortGroups([...new Set(active.map((e) => e.group))]).sort((a, b) => (a === group ? -1 : b === group ? 1 : 0))

  const create = async () => {
    const clean = name.trim()
    if (!clean) return
    const id = (await db.exercises.add({ name: clean, group, kind: 'strength', perSide: false, step: 2.5, rest: 0 })) as number
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
