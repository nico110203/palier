import { num, shortDate } from '../format'

export interface Point {
  at: number
  value: number
}

/** Une grandeur par exercice, un point par séance, axe x en séances. */
export function Chart({ points, unit }: { points: Point[]; unit: string }) {
  const W = 340
  const H = 180
  const pad = { l: 40, r: 12, t: 12, b: 26 }
  if (points.length < 2) {
    return <p className="caption">Le graphique apparaît à partir de deux séances.</p>
  }
  const values = points.map((p) => p.value)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (lo === hi) {
    lo -= 5
    hi += 5
  }
  const span = hi - lo
  lo = Math.max(0, lo - span * 0.15)
  hi = hi + span * 0.15
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)

  // Repères ronds (au plus 5) : pas choisi parmi des valeurs de disques usuelles.
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100].find((s) => (hi - lo) / s <= 4) ?? 100
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
  const dateIdx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points.length - 1
  const area = `${d} L${x(last).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Évolution sur ${points.length} séances, de ${num(points[0].value)} à ${num(points[last].value)} ${unit}`}>
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop className="fill-top" offset="0" />
          <stop className="fill-bottom" offset="1" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text className="axis" x={pad.l - 8} y={y(t) + 4} textAnchor="end">
            {num(t, 1)}
          </text>
        </g>
      ))}
      {dateIdx.map((i) => (
        <text key={i} className="axis" x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>
          {shortDate(points[i].at)}
        </text>
      ))}
      <path className="area" d={area} />
      <path className="curve" d={d} />
      {points.map((p, i) =>
        i === last ? (
          <g key={i}>
            <circle className="halo" cx={x(i)} cy={y(p.value)} r={10} />
            <circle className="dot dot-last" cx={x(i)} cy={y(p.value)} r={4} />
          </g>
        ) : (
          <circle key={i} className="dot" cx={x(i)} cy={y(p.value)} r={4} />
        ),
      )}
    </svg>
  )
}
