const NBSP = ' '
const NNBSP = ' '
const MINUS = '−'

export function num(n: number, maxDecimals = 2): string {
  const s = n.toLocaleString('fr-FR', { maximumFractionDigits: maxDecimals })
  return s.replace(/\s/g, NNBSP)
}

export function kg(n: number): string {
  if (n >= 1000) return `${num(n / 1000, 1)}${NBSP}t`
  return `${num(n)}${NBSP}kg`
}

/** « 67,5 kg × 8 » */
export function setLabel(w: number, reps: number): string {
  return `${kg(w)} × ${reps}`
}

export function signed(n: number, unit = 'kg'): string {
  if (n === 0) return '='
  const sign = n > 0 ? '+' : MINUS
  return `${sign}${num(Math.abs(n))}${unit ? NBSP + unit : ''}`
}

/** « 27 oct. », année ajoutée hors année courante. */
export function shortDate(ts: number): string {
  const d = new Date(ts)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function duration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}${NBSP}min`
  return `${Math.floor(min / 60)}${NBSP}h${NBSP}${String(min % 60).padStart(2, '0')}`
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Accepte la virgule et le point. */
export function parseNum(s: string): number {
  const n = parseFloat(s.replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function cardioLabel(s: { speed?: number; incline?: number; minutes?: number }): string {
  const parts: string[] = []
  if (s.speed) parts.push(`${num(s.speed)}${NBSP}km/h`)
  if (s.incline != null && s.incline !== 0) parts.push(`incl.${NBSP}${num(s.incline)}`)
  if (s.minutes) parts.push(`${num(s.minutes)}${NBSP}min`)
  return parts.join(' · ') || '—'
}
