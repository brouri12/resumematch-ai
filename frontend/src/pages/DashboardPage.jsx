import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { api } from '../api'
import ScoreTimeline from '../components/ScoreTimeline'
import { Alert, EmptyState, ScoreGauge, StatusBadge } from '../components/ui'
import { CountUp, Loader, PageHeader, Reveal, Stagger, StaggerItem, TiltCard } from '../components/motion'
import { useI18n } from '../context/I18nContext'
import { useSystemStatus } from '../context/SystemStatusContext'

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const { status: system } = useSystemStatus()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.dashboardStats()
        if (!cancelled) setStats(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <Loader label={t('common.loading')} />
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t('dash.eyebrow')} title={t('dash.title')} subtitle={t('dash.subtitle')}>
        <div className="flex flex-col items-end gap-2">
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
            <Link
              to="/analyse"
              className="btn-shine block rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-coral/30 hover:bg-coral/90"
            >
              {t('nav.analyze')}
            </Link>
          </motion.div>
          {typeof system?.quota_remaining === 'number' && (
            <span className="text-xs text-moss">{t('quota.remaining', { n: system.quota_remaining })}</span>
          )}
        </div>
      </PageHeader>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <Stagger className="mt-10 grid gap-6 sm:grid-cols-3" delay={0.3} gap={0.12}>
        <Stat label={t('dash.analyses')} value={stats?.analyses_count ?? 0} />
        <Stat label={t('dash.avg')} value={stats?.average_score ?? 0} suffix="/100" />
        <Stat
          label={t('dash.active')}
          value={(stats?.by_status?.to_apply || 0) + (stats?.by_status?.applied || 0) + (stats?.by_status?.interview || 0)}
        />
      </Stagger>

      <Reveal as="section" className="glass mt-14 p-6">
        <h2 className="font-display text-2xl font-semibold text-forest">{t('dash.evolution')}</h2>
        <p className="mb-4 text-sm text-moss">{t('dash.evolutionHint')}</p>
        <ScoreTimeline timeline={stats?.timeline || []} />
      </Reveal>

      <section className="mt-14">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold text-forest">{t('dash.recent')}</h2>
        </Reveal>
        {!stats?.recent?.length ? (
          <div className="mt-4">
            <EmptyState title={t('dash.empty')}>
              <Link to="/analyse" className="mt-3 inline-block font-semibold text-coral hover:underline">
                {t('dash.first')}
              </Link>
            </EmptyState>
          </div>
        ) : (
          <Stagger as="ul" inView className="mt-4 divide-y divide-forest/10 border-y border-forest/10" gap={0.07}>
            {stats.recent.map((item) => (
              <StaggerItem
                as="li"
                key={item.id}
                whileHover={{ x: 6, backgroundColor: 'rgba(255,255,255,0.45)' }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-4"
              >
                <div>
                  <Link to={`/resultats/${item.id}`} className="font-semibold text-forest transition-colors hover:text-coral">
                    {item.job_title}
                  </Link>
                  <p className="text-sm text-moss">
                    {item.company || t('common.companyUnknown')} · {new Date(item.created_at).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                  <CountUp value={item.score} className="font-display text-xl font-bold text-forest" />
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {stats?.analyses_count > 0 && (
        <Reveal className="mt-14 flex flex-col items-center">
          <ScoreGauge score={Math.round(stats.average_score || 0)} />
          <p className="mt-3 text-sm text-moss">{t('dash.globalAvg')}</p>
        </Reveal>
      )}
    </div>
  )
}

function Stat({ label, value, suffix = '' }) {
  const decimals = Number.isInteger(Number(value)) ? 0 : 1
  return (
    <StaggerItem>
      <TiltCard className="glass h-full p-6" max={6}>
        <div className="relative">
          <p className="text-sm uppercase tracking-wide text-moss">{label}</p>
          <p className="mt-2 font-display text-4xl font-bold text-forest">
            <CountUp value={value} decimals={decimals} />
            {suffix && <span className="ml-1 text-base font-normal text-moss">{suffix}</span>}
          </p>
          <motion.div
            className="mt-4 h-1 origin-left rounded-full bg-gradient-to-r from-coral via-leaf to-mint"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </TiltCard>
    </StaggerItem>
  )
}
