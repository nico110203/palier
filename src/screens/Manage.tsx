import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportAll, getSetting, importAll, setSetting, sortGroups, type Exercise } from '../db'
import { num } from '../format'
import { useNav } from '../nav'
import { applyNotes, parseNotes } from '../notes'
import { ExercisePicker } from './Workout'
import { Icon, ScreenHead, Sheet } from '../components/ui'

export type Theme = 'auto' | 'light' | 'dark'

export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}

export function Manage() {
  const nav = useNav()
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray()) ?? []
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [theme, setTheme] = useState<Theme>('auto')
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    getSetting<Theme>('theme', 'auto').then(setTheme)
  }, [])

  const active = exercises.filter((e) => !e.archived)
  const groups = sortGroups([...new Set(active.map((e) => e.group))])

  const changeTheme = (t: Theme) => {
    setTheme(t)
    applyTheme(t)
    setSetting('theme', t)
  }

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `palier-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doRestore = async (f: File) => {
    try {
      await importAll(JSON.parse(await f.text()))
      setMsg('Sauvegarde restaurée')
    } catch (e) {
      setMsg(`Restauration impossible : ${(e as Error).message}`)
    }
  }

  return (
    <main className="screen">
      <ScreenHead title="Exercices" />

      <div className="section" style={{ marginTop: 0 }}>
        <span className="label">Modèles de séance</span>
        <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {templates.map((t) => (
            <button key={t.id} className="list-item" onClick={() => nav.open({ type: 'template', id: t.id! })}>
              <span className="grow">{t.name}</span>
              <span className="caption">{t.slots.length}</span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
        <button
          className="btn btn-ghost"
          style={{ paddingLeft: 0, marginTop: 'var(--space-2)' }}
          onClick={async () => {
            const id = (await db.templates.add({ name: 'Nouveau modèle', order: templates.length, slots: [] })) as number
            nav.open({ type: 'template', id })
          }}
        >
          <Icon name="plus" /> Créer un modèle
        </button>
      </div>

      {groups.map((g) => (
        <div key={g} className="section">
          <span className="label">{g}</span>
          <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
            {active
              .filter((e) => e.group === g)
              .map((e) => (
                <button key={e.id} className="list-item" onClick={() => setEditing(e)}>
                  <span className="grow">{e.name}</span>
                  <span className="caption">{e.kind === 'cardio' ? 'cardio' : `pas ${num(e.step)} kg`}</span>
                  <Icon name="pencil" size={16} />
                </button>
              ))}
          </div>
        </div>
      ))}
      <button
        className="btn btn-ghost"
        style={{ paddingLeft: 0, marginTop: 'var(--space-2)' }}
        onClick={() => setEditing({ name: '', group: groups[0] ?? 'PEC', kind: 'strength', perSide: false, step: 2.5, rest: 120 })}
      >
        <Icon name="plus" /> Ajouter un exercice
      </button>

      <div className="section">
        <span className="label">Affichage</span>
        <div className="chips" role="group" aria-label="Thème">
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} className="chip" aria-pressed={theme === t} onClick={() => changeTheme(t)}>
              {t === 'auto' ? 'Automatique' : t === 'light' ? 'Clair' : 'Sombre'}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <span className="label">Données</span>
        <div className="stack-sm">
          <button className="btn btn-lg" onClick={() => nav.open({ type: 'notes' })}>
            Importer des notes
          </button>
          <button className="btn btn-lg" onClick={doExport}>
            Exporter une sauvegarde
          </button>
          <button className="btn btn-lg" onClick={() => file.current?.click()}>
            Restaurer une sauvegarde
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doRestore(e.target.files[0])} />
          {msg && <p className="caption">{msg}</p>}
        </div>
      </div>

      {editing && <ExerciseEditor ex={editing} groups={groups} onClose={() => setEditing(null)} />}
    </main>
  )
}

function ExerciseEditor({ ex, groups, onClose }: { ex: Exercise; groups: string[]; onClose: () => void }) {
  const [draft, setDraft] = useState<Exercise>(ex)
  const [newGroup, setNewGroup] = useState('')
  const set = (p: Partial<Exercise>) => setDraft((d) => ({ ...d, ...p }))
  const save = async () => {
    const group = newGroup.trim().toUpperCase() || draft.group
    const clean = { ...draft, name: draft.name.trim(), group }
    if (!clean.name) return
    if (clean.id) await db.exercises.put(clean)
    else await db.exercises.add(clean)
    onClose()
  }
  const remove = async () => {
    const used = await db.sets.where('exerciseId').equals(ex.id!).count()
    if (used) await db.exercises.update(ex.id!, { archived: true })
    else await db.exercises.delete(ex.id!)
    for (const t of await db.templates.toArray()) {
      if (t.slots.some((s) => s.exerciseId === ex.id)) await db.templates.update(t.id!, { slots: t.slots.filter((s) => s.exerciseId !== ex.id) })
    }
    onClose()
  }

  return (
    <Sheet title={ex.id ? "Modifier l'exercice" : 'Nouvel exercice'} onClose={onClose}>
      <div className="stack">
        <label className="field">
          <span className="label">Nom</span>
          <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!ex.id} />
        </label>
        <label className="field">
          <span className="label">Nom complet (facultatif)</span>
          <input className="input" placeholder="ex. Développé couché" value={draft.detail ?? ''} onChange={(e) => set({ detail: e.target.value || undefined })} />
        </label>
        <div className="field">
          <span className="label">Groupe</span>
          <div className="chips">
            {groups.map((g) => (
              <button key={g} className="chip" aria-pressed={!newGroup && draft.group === g} onClick={() => (setNewGroup(''), set({ group: g }))}>
                {g}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Autre groupe (ex. JAMBES)" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        </div>
        <div className="field">
          <span className="label">Type</span>
          <div className="chips">
            <button className="chip" aria-pressed={draft.kind === 'strength'} onClick={() => set({ kind: 'strength' })}>
              Charge × reps
            </button>
            <button className="chip" aria-pressed={draft.kind === 'cardio'} onClick={() => set({ kind: 'cardio' })}>
              Cardio
            </button>
          </div>
        </div>
        {draft.kind === 'strength' && (
          <>
            <label className="toggle-row">
              <span>Charge par côté</span>
              <input type="checkbox" checked={draft.perSide} onChange={(e) => set({ perSide: e.target.checked })} />
            </label>
            <div className="field">
              <span className="label">Pas de charge</span>
              <div className="chips">
                {[0.5, 1, 2, 2.5, 5].map((s) => (
                  <button key={s} className="chip" aria-pressed={draft.step === s} onClick={() => set({ step: s })}>
                    {num(s)}&nbsp;kg
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button className="btn btn-lg btn-primary" onClick={save} disabled={!draft.name.trim()}>
          Enregistrer
        </button>
        {ex.id && (
          <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={remove}>
            <Icon name="trash" /> Supprimer l'exercice
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function TemplateEditor({ id }: { id: number }) {
  const nav = useNav()
  const tpl = useLiveQuery(() => db.templates.get(id), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? []
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (!tpl) return null
  const exById = new Map(exercises.map((e) => [e.id!, e]))
  const slots = tpl.slots
  const save = (s: typeof slots) => db.templates.update(id, { slots: s })
  const move = (i: number, d: number) => {
    const s = [...slots]
    ;[s[i], s[i + d]] = [s[i + d], s[i]]
    save(s)
  }

  return (
    <main className="screen">
      <ScreenHead title={tpl.name} onBack={nav.back} />
      <label className="field">
        <span className="label">Nom du modèle</span>
        <input className="input" value={tpl.name} onChange={(e) => db.templates.update(id, { name: e.target.value })} />
      </label>

      <div className="section">
        <span className="label">Exercices</span>
        <div className="stack-sm">
          {slots.map((s, i) => (
            <div key={i} className="card" style={{ padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-4)' }}>
              <div className="row">
                <span className="grow">{exById.get(s.exerciseId)?.name ?? '?'}</span>
                <button className="btn btn-ghost btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">
                  <Icon name="up" />
                </button>
                <button className="btn btn-ghost btn-icon" disabled={i === slots.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">
                  <Icon name="down" />
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => save(slots.filter((_, j) => j !== i))} aria-label="Retirer">
                  <Icon name="x" />
                </button>
              </div>
              {i > 0 && (
                <label className="toggle-row caption">
                  <span>Enchaîné avec le précédent</span>
                  <input type="checkbox" checked={s.superset} onChange={(e) => save(slots.map((x, j) => (j === i ? { ...x, superset: e.target.checked } : x)))} />
                </label>
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ paddingLeft: 0, marginTop: 'var(--space-2)' }} onClick={() => setPicking(true)}>
          <Icon name="plus" /> Ajouter un exercice
        </button>
      </div>

      <div className="section">
        <button className="btn btn-ghost" style={{ color: 'var(--danger)', paddingLeft: 0 }} onClick={() => setConfirm(true)}>
          <Icon name="trash" /> Supprimer le modèle
        </button>
      </div>

      {picking && (
        <ExercisePicker
          exercises={exercises}
          onPick={(eid) => {
            setPicking(false)
            save([...slots, { exerciseId: eid, superset: false }])
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {confirm && (
        <Sheet title="Supprimer le modèle" onClose={() => setConfirm(false)}>
          <p style={{ marginTop: 0 }}>Les exercices et l'historique sont conservés.</p>
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
            <button className="btn btn-lg" onClick={() => setConfirm(false)}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}

export function NotesImport() {
  const nav = useNav()
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const parsed = parseNotes(text)
  const count = parsed.reduce((n, g) => n + g.entries.length, 0)

  return (
    <main className="screen">
      <ScreenHead title="Importer des notes" onBack={nav.back} />
      <p className="caption" style={{ marginTop: 0 }}>
        Colle tes notes : un groupe en capitales par ligne, puis « - Exercice 8x30 » (répétitions × charge). « ⏩ » enchaîne avec l'exercice précédent, « (par côté) » marque une charge par côté.
      </p>
      <label className="field">
        <span className="label">Notes</span>
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={'PEC\n- DCH 8x30'} />
      </label>
      {text && (
        <p className="caption">
          {count} ligne{count > 1 ? 's' : ''} reconnue{count > 1 ? 's' : ''} dans {parsed.length} groupe{parsed.length > 1 ? 's' : ''} : {parsed.map((g) => g.group).join(', ')}
        </p>
      )}
      <button
        className="btn btn-lg btn-primary"
        disabled={!count}
        style={{ marginTop: 'var(--space-4)' }}
        onClick={async () => {
          const r = await applyNotes(parsed)
          setResult(`${r.exercises} exercice${r.exercises > 1 ? 's' : ''} créé${r.exercises > 1 ? 's' : ''}, ${r.sessions} séance${r.sessions > 1 ? 's' : ''} ajoutée${r.sessions > 1 ? 's' : ''} à l'historique`)
          setText('')
        }}
      >
        Importer
      </button>
      {result && <p className="caption">{result}</p>}
    </main>
  )
}
