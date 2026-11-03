/** Silhouette du corps, zone travaillée en couleur d'accent. */
type Zone = 'pec' | 'dos' | 'epaules' | 'biceps' | 'triceps' | 'jambes' | 'abdos' | 'cardio' | 'corps'

function zoneOf(name: string): Zone {
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  if (n.includes('CARDIO')) return 'cardio'
  if (n.includes('PEC')) return 'pec'
  if (n.includes('DOS')) return 'dos'
  if (n.includes('EPAUL')) return 'epaules'
  if (n.includes('TRICEP')) return 'triceps'
  if (n.includes('BICEP') || n.includes('BRAS')) return 'biceps'
  if (n.includes('JAMB') || n.includes('CUISS') || n.includes('QUAD') || n.includes('MOLLET') || n.includes('FESS')) return 'jambes'
  if (n.includes('ABDO')) return 'abdos'
  return 'corps'
}

export function MuscleIcon({ name, size = 50 }: { name: string; size?: number }) {
  const zone = zoneOf(name)
  const on = (z: Zone) => (zone === z || zone === 'corps' ? 'var(--accent)' : 'var(--ink-faint)')
  const base = 'var(--ink-faint)'

  if (zone === 'cardio') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="var(--accent)" d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.4 3 5 6.4 5c2 0 3.3 1 4.1 2.2l1.5 2 1.5-2C14.3 6 15.6 5 17.6 5 21 5 22.9 8.4 21.5 11.7 19.5 16.4 12 21 12 21z" />
        <path fill="none" stroke="var(--surface-raised)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" d="M4 12h4l1.5-3 3 6 1.5-3h6" />
      </svg>
    )
  }

  // Dos et triceps : vue de dos.
  const back = zone === 'dos' || zone === 'triceps'
  return (
    <svg width={size} height={size} viewBox="0 0 40 56" aria-hidden="true">
      <circle cx="20" cy="6" r="4.5" fill={base} />
      {/* Épaules */}
      <ellipse cx="10.5" cy="15" rx="3.6" ry="3.2" fill={on('epaules')} />
      <ellipse cx="29.5" cy="15" rx="3.6" ry="3.2" fill={on('epaules')} />
      {back ? (
        <>
          {/* Trapèzes, dorsaux, lombaires */}
          <path d="M15 12.5 20 10.5 25 12.5 20 17z" fill={on('dos')} />
          <path d="M14 14.5 19.4 18v10l-4 2.5-2.2-9z" fill={on('dos')} />
          <path d="M26 14.5 20.6 18v10l4 2.5 2.2-9z" fill={on('dos')} />
          <rect x="16.5" y="29" width="7" height="3.5" rx="1.5" fill={on('dos')} />
        </>
      ) : (
        <>
          {/* Pectoraux, abdos */}
          <path d="M13.8 13.2h5.6v7.3c-2.6.6-4.6.2-6.2-1.4z" fill={on('pec')} />
          <path d="M26.2 13.2h-5.6v7.3c2.6.6 4.6.2 6.2-1.4z" fill={on('pec')} />
          <rect x="15.5" y="22" width="9" height="10.5" rx="2" fill={on('abdos')} />
        </>
      )}
      {/* Bras : biceps devant, triceps derrière */}
      <rect x="5.6" y="18.5" width="4.6" height="9" rx="2.3" fill={back ? on('triceps') : on('biceps')} />
      <rect x="29.8" y="18.5" width="4.6" height="9" rx="2.3" fill={back ? on('triceps') : on('biceps')} />
      <rect x="4.6" y="28.5" width="4" height="9" rx="2" fill={base} />
      <rect x="31.4" y="28.5" width="4" height="9" rx="2" fill={base} />
      {/* Jambes */}
      <rect x="13.4" y="33.5" width="6.2" height="12" rx="3" fill={on('jambes')} />
      <rect x="20.4" y="33.5" width="6.2" height="12" rx="3" fill={on('jambes')} />
      <rect x="14" y="46.5" width="5" height="9" rx="2.5" fill={on('jambes')} />
      <rect x="21" y="46.5" width="5" height="9" rx="2.5" fill={on('jambes')} />
    </svg>
  )
}
