import { db, lastSetsFor, type Exercise, type SetEntry, type TemplateSlot } from './db'

const DEFAULT_SETS = 3

/** Pré-remplit les séries d'un exercice avec celles de la dernière fois. */
async function prefill(sessionId: number, at: number, ex: Exercise, slot: number, occurrence: number) {
  const last = await lastSetsFor(ex.id!, sessionId)
  // Un exercice peut apparaître deux fois (ex. Curl barre en fin de superset) : on reprend la même occurrence.
  const slots = [...new Set(last.map((s) => s.slot))].sort((a, b) => a - b)
  const src = last.filter((s) => s.slot === (slots[occurrence] ?? slots[slots.length - 1]))
  const count = ex.kind === 'cardio' ? 1 : Math.max(src.length, DEFAULT_SETS)
  const rows: SetEntry[] = Array.from({ length: count }, (_, i) => {
    const s = src[i] ?? src[src.length - 1]
    return {
      sessionId, exerciseId: ex.id!, slot, index: i, done: false, at,
      reps: s?.reps ?? (ex.kind === 'cardio' ? 0 : 10),
      kg: s?.kg ?? 0,
      speed: s?.speed, incline: s?.incline, minutes: s?.minutes,
    }
  })
  await db.sets.bulkAdd(rows)
}

export async function startSession(name: string, slots: TemplateSlot[], templateId?: number): Promise<number> {
  const at = Date.now()
  const sessionId = (await db.sessions.add({ name, slots, templateId, startedAt: at })) as number
  const seen = new Map<number, number>()
  for (let i = 0; i < slots.length; i++) {
    const ex = await db.exercises.get(slots[i].exerciseId)
    if (!ex) continue
    const occ = seen.get(ex.id!) ?? 0
    seen.set(ex.id!, occ + 1)
    await prefill(sessionId, at, ex, i, occ)
  }
  return sessionId
}

export async function addExerciseToSession(sessionId: number, exerciseId: number) {
  const session = await db.sessions.get(sessionId)
  const ex = await db.exercises.get(exerciseId)
  if (!session || !ex) return
  const slot = session.slots.length
  const occ = session.slots.filter((s) => s.exerciseId === exerciseId).length
  await db.sessions.update(sessionId, { slots: [...session.slots, { exerciseId, superset: false }] })
  await prefill(sessionId, session.startedAt, ex, slot, occ)
}

export async function addSet(sessionId: number, exerciseId: number, slot: number) {
  const rows = await db.sets.where('sessionId').equals(sessionId).filter((s) => s.slot === slot).sortBy('index')
  const last = rows[rows.length - 1]
  const session = await db.sessions.get(sessionId)
  await db.sets.add({
    sessionId, exerciseId, slot, index: (last?.index ?? -1) + 1, done: false, at: session!.startedAt,
    reps: last?.reps ?? 10, kg: last?.kg ?? 0, speed: last?.speed, incline: last?.incline, minutes: last?.minutes,
  })
}

/** Garde uniquement les séries cochées. Une séance vide est supprimée. */
export async function finishSession(sessionId: number): Promise<boolean> {
  return db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).filter((s) => !s.done).delete()
    const kept = await db.sets.where('sessionId').equals(sessionId).count()
    if (!kept) {
      await db.sessions.delete(sessionId)
      return false
    }
    await db.sessions.update(sessionId, { endedAt: Date.now() })
    return true
  })
}

export async function deleteSession(sessionId: number) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

/** Meilleure charge (puis meilleures reps à cette charge) parmi les séances terminées, hors séance donnée. */
export function best(sets: SetEntry[]): { kg: number; reps: number } | null {
  let b: { kg: number; reps: number } | null = null
  for (const s of sets) {
    if (!s.done) continue
    if (!b || s.kg > b.kg || (s.kg === b.kg && s.reps > b.reps)) b = { kg: s.kg, reps: s.reps }
  }
  return b
}

export function volume(sets: SetEntry[], perSide = false): number {
  return sets.reduce((v, s) => v + (s.done ? s.kg * s.reps * (perSide ? 2 : 1) : 0), 0)
}
