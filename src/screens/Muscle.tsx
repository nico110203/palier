import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveToday, sortGroups, type Exercise, type Log, type MuscleSlot } from '../db'
import { num, parseNum } from '../format'
import { useNav } from '../nav'
import { Icon, ScreenHead, Sheet, useLongPress } from '../components/ui'

/** Champ numérique éditable sur place : chaque frappe est enregistrée. */
function NumField({ value, label, onSave, decimal = true }: { value: number; label: string; onSave: (n: number) => void; decimal?: boolean }) {
  const [draft, setDraft] = useState(num(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(num(value))
  }, [value])
  return (
    <label className="num-field">
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
    </label>
  )
}

/** Dernière série enregistrée, pré-remplie dans les champs. */
const latest = (logs: Log[]) => logs.reduce<Log | undefined>((a, l) => (!a || l.at > a.at ? l : a), undefined)

export function MuscleView({ id }: { id: number }) {
  const nav = useNav()
  // Muscle et séries lus ensemble : l'écran s'affiche d'un bloc, sans lignes qui apparaissent après coup.
  const data = useLiveQuery(async () => {
    const muscle = await db.templates.get(id)
    if (!muscle) return null
    const logs = await db.logs.where('exerciseId').anyOf(muscle.slots.map((s) => s.exerciseId)).toArray()
    return { muscle, logs }
  }, [id])
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const press = useLongPress(() => setEditing(true))

  if (!data || !exercises) return null
  const { muscle, logs } = data
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
                  <span className="title-md grow">{ex.name}</span>
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

          const cur = latest(logs.filter((l) => l.exerciseId === ex.id))
          const cardio = ex.kind === 'cardio'
          const save = (patch: Partial<Log>) => saveToday(ex.id!, patch, cur ?? {})

          return (
            <section key={slot.exerciseId} className="card exo" aria-label={ex.name} {...press.handlers}>
              {slot.superset && (
                <span className="superset-tag" aria-label="Enchaîné">
                  <Icon name="link" size={14} />
                </span>
              )}
              <button className="exo-name" onClick={() => !press.fired() && nav.open({ type: 'exercise', id: ex.id! })}>
                {ex.name}
              </button>

              <div className="set-fields">
                {cardio ? (
                  <>
                    <NumField value={cur?.speed ?? 0} label={`${ex.name}, vitesse`} onSave={(v) => save({ speed: v })} />
                    <NumField value={cur?.minutes ?? 0} label={`${ex.name}, durée`} onSave={(v) => save({ minutes: v })} />
                  </>
                ) : (
                  <>
                    <NumField value={cur?.reps ?? 0} decimal={false} label={`${ex.name}, répétitions`} onSave={(v) => save({ reps: v })} />
                    <span className="times" aria-hidden="true">×</span>
                    <NumField value={cur?.kg ?? 0} label={`${ex.name}, charge en kg`} onSave={(v) => save({ kg: v })} />
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
