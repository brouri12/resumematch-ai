export function ScoreGauge({ score, size = 140 }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#2f6b55' : score >= 50 ? '#e8a317' : '#c45c26'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#d8e8df" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-forest">{score}</span>
        <span className="text-xs uppercase tracking-wider text-moss">/ 100</span>
      </div>
    </div>
  )
}

export function SkillChips({ items = [], variant = 'present' }) {
  const styles =
    variant === 'missing'
      ? 'bg-coral/10 text-coral border-coral/20'
      : 'bg-moss/10 text-forest border-moss/20'

  if (!items.length) {
    return <p className="text-sm text-moss/70">Aucune compétence listée.</p>
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((skill) => (
        <li
          key={skill}
          className={`rounded-md border px-2.5 py-1 text-sm font-medium ${styles}`}
        >
          {skill}
        </li>
      ))}
    </ul>
  )
}

export function StatusBadge({ status }) {
  const labels = {
    to_apply: 'À postuler',
    applied: 'Envoyée',
    interview: 'Entretien',
    rejected: 'Refusé',
    offer: 'Offre',
  }
  const colors = {
    to_apply: 'bg-amber/20 text-forest',
    applied: 'bg-moss/15 text-moss',
    interview: 'bg-leaf/20 text-forest',
    rejected: 'bg-coral/15 text-coral',
    offer: 'bg-mint text-forest',
  }
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${colors[status] || colors.to_apply}`}>
      {labels[status] || status}
    </span>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-forest/20 bg-white/50 px-6 py-10 text-center">
      <h3 className="font-display text-xl text-forest">{title}</h3>
      <div className="mt-2 text-sm text-moss">{children}</div>
    </div>
  )
}

export function Alert({ type = 'error', children }) {
  const styles =
    type === 'error'
      ? 'border-coral/30 bg-coral/10 text-coral'
      : type === 'success'
        ? 'border-moss/30 bg-moss/10 text-forest'
        : 'border-amber/40 bg-amber/10 text-forest'
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`} role="alert">
      {children}
    </div>
  )
}

export const LEVEL_LABELS = {
  etudiant: 'Étudiant',
  junior: 'Junior',
  confirme: 'Confirmé',
}

export const STATUS_OPTIONS = [
  { value: 'to_apply', label: 'À postuler' },
  { value: 'applied', label: 'Candidature envoyée' },
  { value: 'interview', label: 'Entretien' },
  { value: 'rejected', label: 'Refusé' },
  { value: 'offer', label: 'Offre reçue' },
]
