import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { num, parseNum } from '../format'

/* Icônes au trait 24 px, trait 2 px, d'après Lucide (ISC). */
const PATHS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M20 6 9 17l-5-5" />,
  up: <path d="m5 12 7-7 7 7M12 19V5" />,
  down: <path d="M12 5v14M19 12l-7 7-7-7" />,
  back: <path d="m15 18-6-6 6-6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  dumbbell: (
    <>
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.66 21.51a2 2 0 1 1-2.83-2.83l-1.77 1.77a2 2 0 1 1-2.83-2.83l6.37-6.37a2 2 0 1 1 2.83 2.83l-1.77 1.77a2 2 0 1 1 2.83 2.83z" />
      <path d="m21.5 21.5-1.4-1.4M3.9 3.9 2.5 2.5" />
      <path d="M6.4 12.77a2 2 0 1 1-2.83-2.83l1.77-1.77a2 2 0 1 1-2.83-2.83l2.83-2.83a2 2 0 1 1 2.83 2.83l1.77-1.77a2 2 0 1 1 2.83 2.83z" />
    </>
  ),
  chart: <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  timer: (
    <>
      <path d="M10 2h4M12 14l3-3" />
      <circle cx="12" cy="14" r="8" />
    </>
  ),
  link: <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" />,
  trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  pencil: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  trophy: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
}

export function Icon({ name, size = 24, label }: { name: keyof typeof PATHS | string; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {PATHS[name]}
    </svg>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="title-md grow">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Stepper({
  label,
  unit,
  value,
  step,
  min = 0,
  onChange,
}: {
  label: string
  unit: string
  value: number
  step: number
  min?: number
  onChange: (v: number) => void
}) {
  const round = (v: number) => Math.max(min, Math.round(v * 100) / 100)
  return (
    <div>
      <div className="stepper-label">
        <span className="label">{label}</span>
        <span className="caption">pas {num(step)} {unit}</span>
      </div>
      <div className="stepper">
        <button type="button" onClick={() => onChange(round(value - step))} aria-label={`Moins ${num(step)} ${unit}`}>
          <Icon name="minus" />
        </button>
        <input
          className="numeral-lg"
          inputMode="decimal"
          aria-label={`${label} en ${unit}`}
          value={num(value)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(round(parseNum(e.currentTarget.value)))}
        />
        <button type="button" onClick={() => onChange(round(value + step))} aria-label={`Plus ${num(step)} ${unit}`}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  )
}

export function DeltaBadge({ delta, unit = 'kg' }: { delta: number; unit?: string }) {
  const MINUS = '−'
  if (delta === 0) return <span className="badge">=</span>
  const up = delta > 0
  return (
    <span className={`badge ${up ? 'badge-up' : 'badge-down'}`}>
      <Icon name={up ? 'up' : 'down'} size={16} />
      {up ? '+' : MINUS}
      {num(Math.abs(delta))}
      {' '}
      {unit}
    </span>
  )
}

export function ScreenHead({ title, onBack, children }: { title: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <header className="screen-head">
      {onBack && (
        <button className="btn btn-icon" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
      )}
      <h1 className="title-lg grow">{title}</h1>
      {children}
    </header>
  )
}

/**
 * Appui long (500 ms) sur un élément, hors champs de saisie et boutons internes.
 * Renvoie les gestionnaires à poser sur l'élément ; `fired()` dit si le dernier appui était long.
 */
export function useLongPress(onLong: () => void, ms = 500) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const long = useRef(false)
  const cancel = () => {
    window.clearTimeout(timer.current)
    start.current = null
  }
  return {
    fired: () => long.current,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        long.current = false
        if ((e.target as HTMLElement).closest('input, .no-long-press')) return
        start.current = { x: e.clientX, y: e.clientY }
        timer.current = window.setTimeout(() => {
          long.current = true
          navigator.vibrate?.(30)
          onLong()
        }, ms)
      },
      onPointerMove: (e: PointerEvent) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
  }
}
