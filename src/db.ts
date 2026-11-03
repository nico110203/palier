import Dexie, { type EntityTable } from 'dexie'

export type ExerciseKind = 'strength' | 'cardio'

export interface Exercise {
  id?: number
  name: string
  group: string
  kind: ExerciseKind
  perSide: boolean
  /** Pas du stepper de charge, en kg. */
  step: number
  /** Repos par défaut après une série, en secondes. */
  rest: number
  archived?: boolean
}

export interface TemplateSlot {
  exerciseId: number
  /** Enchaîné avec l'exercice précédent (superset). */
  superset: boolean
}

export interface Template {
  id?: number
  name: string
  order: number
  slots: TemplateSlot[]
}

export interface Session {
  id?: number
  name: string
  templateId?: number
  slots: TemplateSlot[]
  startedAt: number
  endedAt?: number
}

export interface SetEntry {
  id?: number
  sessionId: number
  exerciseId: number
  /** Position de l'exercice dans la séance. */
  slot: number
  index: number
  reps: number
  kg: number
  minutes?: number
  speed?: number
  incline?: number
  done: boolean
  /** Copie de session.startedAt pour trier l'historique sans jointure. */
  at: number
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('palier') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  templates: EntityTable<Template, 'id'>
  sessions: EntityTable<Session, 'id'>
  sets: EntityTable<SetEntry, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  exercises: '++id, group',
  templates: '++id, order',
  sessions: '++id, startedAt, endedAt',
  sets: '++id, sessionId, exerciseId, at, [exerciseId+at]',
  settings: 'key',
})

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

/** Séries de la dernière séance terminée contenant cet exercice. */
export async function lastSetsFor(exerciseId: number, beforeSessionId?: number): Promise<SetEntry[]> {
  const all = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const ended = new Set((await db.sessions.filter((s) => s.endedAt != null).toArray()).map((s) => s.id))
  const past = all.filter((s) => s.sessionId !== beforeSessionId && ended.has(s.sessionId) && s.done)
  if (!past.length) return []
  const lastAt = Math.max(...past.map((s) => s.at))
  const lastSession = past.find((s) => s.at === lastAt)!.sessionId
  return past.filter((s) => s.sessionId === lastSession).sort((a, b) => a.index - b.index)
}

export async function exportAll() {
  return {
    app: 'palier',
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    templates: await db.templates.toArray(),
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
  }
}

export async function importAll(data: Awaited<ReturnType<typeof exportAll>>) {
  if (data?.app !== 'palier') throw new Error('Fichier non reconnu')
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.sets], async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear(), db.sets.clear()])
    await db.exercises.bulkAdd(data.exercises)
    await db.templates.bulkAdd(data.templates ?? [])
    await db.sessions.bulkAdd(data.sessions)
    await db.sets.bulkAdd(data.sets)
  })
}
