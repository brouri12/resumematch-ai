import { AnimatePresence, motion } from 'motion/react'
import { CountUp, EASE } from './motion'
import { useI18n } from '../context/I18nContext'
import { useSystemStatus } from '../context/SystemStatusContext'

export function ScoreGauge({ score, size = 140 }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#2f6b55' : score >= 50 ? '#e8a317' : '#c45c26'

  return (
    <motion.div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: EASE }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-2 rounded-full blur-2xl"
        style={{ backgroundColor: color }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: [0, 0.35, 0.2] }}
        viewport={{ once: true }}
        transition={{ duration: 2.2, delay: 0.4 }}
      />
      <svg viewBox="0 0 120 120" className="relative h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#d8e8df" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, delay: 0.3, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={score} duration={1.8} className="font-display text-3xl font-bold text-forest" />
        <span className="text-xs uppercase tracking-wider text-moss">/ 100</span>
      </div>
    </motion.div>
  )
}

export function SkillChips({ items = [], variant = 'present' }) {
  const styles =
    variant === 'missing'
      ? 'bg-amber/15 text-forest border-amber/40'
      : 'bg-moss/10 text-forest border-moss/20'

  if (!items.length) {
    return <p className="text-sm text-moss/70">Aucune compétence listée.</p>
  }

  return (
    <motion.ul
      className="flex flex-wrap gap-2"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {items.map((skill) => (
        <motion.li
          key={skill}
          variants={{
            hidden: { opacity: 0, scale: 0.6, y: 10 },
            show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 20 } },
          }}
          whileHover={{ y: -3, scale: 1.06 }}
          className={`cursor-default rounded-md border px-2.5 py-1 text-sm font-medium ${styles}`}
        >
          {skill}
        </motion.li>
      ))}
    </motion.ul>
  )
}

export function StatusBadge({ status }) {
  const { t } = useI18n()
  const colors = {
    to_apply: 'bg-amber/20 text-forest',
    applied: 'bg-moss/15 text-moss',
    interview: 'bg-leaf/20 text-forest',
    rejected: 'bg-forest/10 text-forest',
    offer: 'bg-mint text-forest',
  }
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${colors[status] || colors.to_apply}`}>
      {t(`status.${status}`)}
    </span>
  )
}

export function DemoBanner() {
  const { status } = useSystemStatus()
  const { t } = useI18n()
  return (
    <AnimatePresence>
      {status?.announcement && (
        <motion.div
          key="announcement"
          className="no-print border-b border-leaf/30 bg-mint/40 px-4 py-2 text-center text-xs font-medium text-forest sm:text-sm"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          📢 {status.announcement}
        </motion.div>
      )}
      {status?.llm_mode === 'mock' && (
        <motion.div
          key="demo"
          className="no-print border-b border-amber/40 bg-amber/15 px-4 py-2 text-center text-xs font-medium text-forest sm:text-sm"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          ⚠ {t('demo.banner')}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AiModeBadge({ mode }) {
  const { t } = useI18n()
  if (mode !== 'mock' && mode !== 'mixed') return null
  return (
    <span
      title={t('demo.tooltip')}
      className="inline-flex items-center gap-1 rounded-md border border-amber/50 bg-amber/15 px-2 py-0.5 text-xs font-semibold text-forest"
    >
      ⚠ {t(mode === 'mock' ? 'demo.badge' : 'demo.mixed')}
    </span>
  )
}

export function EmptyState({ title, children }) {
  return (
    <motion.div
      className="rounded-2xl border border-dashed border-forest/20 bg-white/50 px-6 py-10 text-center backdrop-blur"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <motion.div
        className="mx-auto mb-4 h-12 w-12 rounded-full bg-gradient-to-br from-mint to-leaf/60"
        animate={{ y: [0, -8, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <h3 className="font-display text-xl text-forest">{title}</h3>
      <div className="mt-2 text-sm text-moss">{children}</div>
    </motion.div>
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
    <motion.div
      className={`rounded-xl border px-4 py-3 text-sm ${styles}`}
      role="alert"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: type === 'error' ? [0, -6, 6, -3, 3, 0] : 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.div>
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
