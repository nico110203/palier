import { useEffect, useRef, useState } from 'react'
import { clock } from '../format'
import { useNav } from '../nav'
import { Icon } from './ui'

export function RestTimer() {
  const { rest, stopRest, addRest } = useNav()
  const [, setNow] = useState(0)
  const buzzed = useRef(false)

  useEffect(() => {
    buzzed.current = false
    if (!rest) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [rest])

  if (!rest) return null
  const left = (rest.endAt - Date.now()) / 1000
  const over = left <= 0
  if (over && !buzzed.current) {
    buzzed.current = true
    navigator.vibrate?.([300, 150, 300, 150, 300])
  }
  const progress = Math.min(1, Math.max(0, 1 - left / rest.total))

  return (
    <div className={`rest${over ? ' over' : ''}`} role="timer" aria-live={over ? 'assertive' : 'off'}>
      <Icon name="timer" />
      <div className="grow">
        <div className="label">{over ? 'Repos terminé' : 'Repos'}</div>
        <div className="numeral-md">{over ? `+${clock(-left)}` : clock(left)}</div>
      </div>
      {!over && (
        <button className="btn" onClick={() => addRest(30)}>
          +30 s
        </button>
      )}
      <button className={`btn ${over ? 'btn-primary' : ''}`} onClick={stopRest}>
        {over ? 'Fermer' : 'Passer'}
      </button>
      <div className="rest-bar" style={{ width: `${progress * 100}%` }} />
    </div>
  )
}
