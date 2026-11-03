import { db, type Exercise, type TemplateSlot } from './db'

/** Notes de départ de Nicolas (bloc-notes Android). */
export const INITIAL_NOTES = `PEC
- DCH 8x30
- Développé décliné 6x70
- Développé incliné 5x60
- Chest press disque 8x80
- Vertical Chest press circular 12x55

BICEPS
- Curl haltère 10x16
- Curl barre 15x15
- Curl incliné 10x14
- Curl poulie basse corde 12x15
⏩  Curl barre 8x15

ÉPAULES
- Développé militaire 7x20
- Elevations latérales 15x8
- Shrugs 12x26

DOS
- Muscle up 1x17, 5
- Tirage horizontal poulie 12x52
- Rowing barre 8x70
- Tirage disque 10x80 (par côté)
- Machine shrugs 10x50 (par côté)

TRICEPS
- Barre au front 10x25
- Extension corde 10x20
- Extension V poulie basse 8x24

CARDIO ZONE 2
- Marche rapide inclinaison 10 vitesse 5,5
- Course vitesse 7

12 MINUTES
07/02/26 : 12km/h inclinaison 0`

interface ParsedEntry {
  name: string
  superset: boolean
  perSide: boolean
  kind: 'strength' | 'cardio'
  reps?: number
  kg?: number
  speed?: number
  incline?: number
  minutes?: number
  at?: number
}

export interface ParsedGroup {
  group: string
  entries: ParsedEntry[]
}

const n = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

function normGroup(line: string): string {
  const up = line.toUpperCase().trim()
  if (up.startsWith('CARDIO')) return 'CARDIO'
  if (up.startsWith('PEC')) return 'PEC'
  return up
}

function cardioParams(text: string) {
  const speed = text.match(/(?:vitesse\s*)?(\d+(?:[.,]\d+)?)\s*km\/h|vitesse\s*(\d+(?:[.,]\d+)?)/i)
  const incline = text.match(/inclinaison\s*(\d+(?:[.,]\d+)?)/i)
  const minutes = text.match(/(\d+(?:[.,]\d+)?)\s*min/i)
  return {
    speed: speed ? n(speed[1] ?? speed[2]) : undefined,
    incline: incline ? n(incline[1]) : undefined,
    minutes: minutes ? n(minutes[1]) : undefined,
  }
}

export function parseNotes(text: string): ParsedGroup[] {
  const groups: ParsedGroup[] = []
  let current: ParsedGroup | null = null
  let cardioName: string | null = null
  let cardioMinutes: number | undefined

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    const strength = line.match(/^(?:[-•*]|⏩️?)\s*(.+?)\s+(\d+)\s*[x×]\s*(\d+(?:\s*[.,]\s*\d+)?)\s*(\(par c[ôo]t[ée]\))?\s*$/i)
    const dated = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*:\s*(.+)$/)
    const isItem = /^(?:[-•*]|⏩)/.test(line)

    if (strength && current) {
      current.entries.push({
        name: strength[1].trim(),
        superset: line.startsWith('⏩'),
        perSide: !!strength[4],
        kind: 'strength',
        reps: parseInt(strength[2], 10),
        kg: n(strength[3]),
      })
    } else if (dated && current) {
      const year = dated[3].length === 2 ? 2000 + parseInt(dated[3], 10) : parseInt(dated[3], 10)
      const at = new Date(year, parseInt(dated[2], 10) - 1, parseInt(dated[1], 10), 12).getTime()
      const p = cardioParams(dated[4])
      current.entries.push({
        name: cardioName ?? 'Cardio',
        superset: false,
        perSide: false,
        kind: 'cardio',
        ...p,
        minutes: p.minutes ?? cardioMinutes,
        at,
      })
    } else if (isItem && current) {
      const body = line.replace(/^(?:[-•*]|⏩️?)\s*/, '')
      const name = body.split(/\s+(?:inclinaison|vitesse|\d)/i)[0].trim() || body
      current.entries.push({ name, superset: false, perSide: false, kind: 'cardio', ...cardioParams(body) })
    } else if (current?.group === 'CARDIO' && /\d/.test(line) && !line.toUpperCase().startsWith('CARDIO')) {
      // Sous-titre de cardio, ex. « 12 MINUTES » : les lignes datées suivantes lui appartiennent.
      const mins = line.match(/(\d+(?:[.,]\d+)?)\s*min/i)
      cardioMinutes = mins ? n(mins[1]) : undefined
      cardioName = mins ? `Course ${num0(cardioMinutes!)} min` : cap(line)
    } else {
      current = { group: normGroup(line), entries: [] }
      cardioName = null
      cardioMinutes = undefined
      groups.push(current)
    }
  }
  return groups.filter((g) => g.entries.length)
}

function num0(x: number) {
  return String(x).replace('.', ',')
}

/** Crée exercices, modèles et une séance par groupe (datée de la veille, ou de la date notée). */
export async function applyNotes(groups: ParsedGroup[]): Promise<{ exercises: number; sessions: number }> {
  let createdExercises = 0
  let createdSessions = 0
  const importDay = new Date()
  importDay.setDate(importDay.getDate() - 1)
  importDay.setHours(12, 0, 0, 0)

  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.sets], async () => {
    const existing = await db.exercises.toArray()
    let templateOrder = await db.templates.count()

    const findOrCreate = async (group: string, e: ParsedEntry): Promise<number> => {
      const hit = existing.find((x) => x.group === group && x.name.toLowerCase() === e.name.toLowerCase())
      if (hit) return hit.id!
      const ex: Exercise = {
        name: e.name,
        group,
        kind: e.kind,
        perSide: e.perSide,
        step: e.kind === 'cardio' ? 0.5 : /halt[èe]re|lat[ée]rales/i.test(e.name) ? 1 : 2.5,
        rest: e.kind === 'cardio' ? 0 : 120,
      }
      ex.id = await db.exercises.add(ex)
      existing.push(ex)
      createdExercises++
      return ex.id!
    }

    for (const g of groups) {
      const undated = g.entries.filter((e) => e.at == null)
      const slots: TemplateSlot[] = []
      const ids: number[] = []
      for (const e of g.entries) {
        const id = await findOrCreate(g.group, e)
        ids.push(id)
        // Une ligne datée (historique cardio) n'ajoute l'exercice au modèle qu'une fois.
        if (e.at == null || !slots.some((s) => s.exerciseId === id)) slots.push({ exerciseId: id, superset: e.superset })
      }

      const tpl = await db.templates.filter((t) => t.name === g.group).first()
      if (!tpl) await db.templates.add({ name: g.group, order: templateOrder++, slots })

      if (undated.length) {
        const at = importDay.getTime()
        const sessionId = (await db.sessions.add({ name: g.group, slots, startedAt: at, endedAt: at })) as number
        createdSessions++
        let slot = 0
        for (const e of g.entries) {
          if (e.at != null) continue
          await db.sets.add({
            sessionId, exerciseId: ids[g.entries.indexOf(e)], slot: slot++, index: 0,
            reps: e.reps ?? 0, kg: e.kg ?? 0, speed: e.speed, incline: e.incline, minutes: e.minutes,
            done: true, at,
          })
        }
      }

      for (const e of g.entries.filter((x) => x.at != null)) {
        const id = ids[g.entries.indexOf(e)]
        const sessionId = (await db.sessions.add({ name: e.name, slots: [{ exerciseId: id, superset: false }], startedAt: e.at!, endedAt: e.at! })) as number
        createdSessions++
        await db.sets.add({ sessionId, exerciseId: id, slot: 0, index: 0, reps: 0, kg: 0, speed: e.speed, incline: e.incline, minutes: e.minutes, done: true, at: e.at! })
      }
    }
  })
  return { exercises: createdExercises, sessions: createdSessions }
}
