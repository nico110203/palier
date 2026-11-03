import Dexie, { type EntityTable } from 'dexie'

export type ExerciseKind = 'strength' | 'cardio'

export interface Exercise {
  id?: number
  name: string
  /** Nom complet affiché sous une abréviation (ex. DCH → Développé couché). */
  detail?: string
  group: string
  kind: ExerciseKind
  perSide: boolean
  /** Pas de charge, en kg. */
  step: number
  rest: number
  archived?: boolean
}

export interface MuscleSlot {
  exerciseId: number
  /** Enchaîné avec l'exercice précédent (superset). */
  superset: boolean
  hidden?: boolean
}

/** Un muscle (PEC, DOS…) : liste ordonnée d'exercices. */
export interface Muscle {
  id?: number
  name: string
  order: number
  slots: MuscleSlot[]
}

/** Valeur d'un exercice pour un jour donné : une seule ligne par exercice et par jour. */
export interface Log {
  id?: number
  exerciseId: number
  /** Jour local AAAA-MM-JJ. */
  day: string
  at: number
  reps: number
  kg: number
  speed?: number
  minutes?: number
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('palier') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  templates: EntityTable<Muscle, 'id'>
  logs: EntityTable<Log, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  exercises: '++id, group',
  templates: '++id, order',
  sessions: '++id, startedAt, endedAt',
  sets: '++id, sessionId, exerciseId, at, [exerciseId+at]',
  settings: 'key',
})

// v2 : plus de séances. Chaque exercice garde une valeur par jour.
db.version(2)
  .stores({
    exercises: '++id, group',
    templates: '++id, order',
    logs: '++id, exerciseId, day, at, [exerciseId+day]',
    sessions: null,
    sets: null,
    settings: 'key',
  })
  .upgrade(async (tx) => {
    const sets = (await tx.table('sets').toArray()) as OldSet[]
    await tx.table('logs').bulkAdd(setsToLogs(sets))
    await tx
      .table('templates')
      .toCollection()
      .modify((m: Muscle) => {
        m.slots = dedupe(m.slots)
      })
  })

interface OldSet {
  exerciseId: number
  at: number
  reps: number
  kg: number
  speed?: number
  minutes?: number
  done?: boolean
}

/** Meilleure série de chaque exercice pour chaque jour. */
export function setsToLogs(sets: OldSet[]): Log[] {
  const byKey = new Map<string, Log>()
  for (const s of sets) {
    if (s.done === false) continue
    const day = dayKey(s.at)
    const key = `${s.exerciseId}|${day}`
    const prev = byKey.get(key)
    if (!prev || s.kg > prev.kg || (s.kg === prev.kg && s.reps > prev.reps) || (s.speed ?? 0) > (prev.speed ?? 0)) {
      byKey.set(key, { exerciseId: s.exerciseId, day, at: s.at, reps: s.reps, kg: s.kg, speed: s.speed, minutes: s.minutes })
    }
  }
  return [...byKey.values()]
}

/** Un exercice n'apparaît qu'une fois par muscle. */
export function dedupe(slots: MuscleSlot[]): MuscleSlot[] {
  const seen = new Set<number>()
  return slots.filter((s) => !seen.has(s.exerciseId) && seen.add(s.exerciseId))
}

export function dayKey(ts = Date.now()): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const GROUP_ORDER = ['PEC', 'DOS', 'ÉPAULES', 'BICEPS', 'TRICEPS', 'JAMBES', 'CARDIO']

export function sortGroups(groups: string[]): string[] {
  return [...groups].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a)
    const ib = GROUP_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, 'fr')
  })
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return (row?.value as T) ?? fallback
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value })
}

/** Enregistre la valeur du jour (crée ou remplace la ligne du jour). */
export async function saveToday(exerciseId: number, patch: Partial<Pick<Log, 'reps' | 'kg' | 'speed' | 'minutes'>>, current: Partial<Log>) {
  const day = dayKey()
  // Transaction rw : les frappes rapides sont sérialisées, sinon deux lignes du jour se créent.
  await db.transaction('rw', db.logs, async () => {
    const existing = await db.logs.where('[exerciseId+day]').equals([exerciseId, day]).first()
    if (existing) await db.logs.update(existing.id!, { ...patch, at: Date.now() })
    else
      await db.logs.add({
        exerciseId, day, at: Date.now(),
        reps: current.reps ?? 0, kg: current.kg ?? 0, speed: current.speed, minutes: current.minutes,
        ...patch,
      })
  })
}

export async function exportAll() {
  return {
    app: 'palier',
    version: 2,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    templates: await db.templates.toArray(),
    logs: await db.logs.toArray(),
  }
}

export async function importAll(data: Awaited<ReturnType<typeof exportAll>> & { sets?: OldSet[] }) {
  if (data?.app !== 'palier') throw new Error('Fichier non reconnu')
  const logs = data.logs ?? setsToLogs(data.sets ?? [])
  await db.transaction('rw', [db.exercises, db.templates, db.logs], async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.logs.clear()])
    await db.exercises.bulkAdd(data.exercises)
    await db.templates.bulkAdd((data.templates ?? []).map((m) => ({ ...m, slots: dedupe(m.slots) })))
    await db.logs.bulkAdd(logs)
  })
}

export async function moveMuscle(id: number, dir: -1 | 1) {
  const all = await db.templates.orderBy('order').toArray()
  const i = all.findIndex((m) => m.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= all.length) return
  ;[all[i], all[j]] = [all[j], all[i]]
  await db.transaction('rw', db.templates, () => Promise.all(all.map((m, k) => db.templates.update(m.id!, { order: k }))))
}
