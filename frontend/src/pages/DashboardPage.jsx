import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Alert, EmptyState, ScoreGauge, StatusBadge } from '../components/ui'

export default function DashboardPage() {
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
    return <div className="mx-auto max-w-6xl px-4 py-12 text-moss">Chargement du tableau de bord…</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest">Tableau de bord</h1>
          <p className="mt-1 text-moss">Vue d’ensemble de vos candidatures analysées.</p>
        </div>
        <Link
          to="/analyse"
          className="rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral/90"
        >
          Nouvelle analyse
        </Link>
      </div>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        <Stat label="Analyses" value={stats?.analyses_count ?? 0} />
        <Stat label="Score moyen" value={stats?.average_score ?? 0} suffix="/100" />
        <Stat
          label="En cours"
          value={(stats?.by_status?.to_apply || 0) + (stats?.by_status?.applied || 0) + (stats?.by_status?.interview || 0)}
        />
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold text-forest">Candidatures récentes</h2>
        {!stats?.recent?.length ? (
          <div className="mt-4">
            <EmptyState title="Aucune analyse pour le moment">
              <Link to="/analyse" className="mt-3 inline-block font-semibold text-coral hover:underline">
                Lancer votre première analyse
              </Link>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-forest/10 border-y border-forest/10">
            {stats.recent.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link to={`/resultats/${item.id}`} className="font-semibold text-forest hover:text-coral">
                    {item.job_title}
                  </Link>
                  <p className="text-sm text-moss">
                    {item.company || 'Entreprise non renseignée'} ·{' '}
                    {new Date(item.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                  <span className="font-display text-xl font-bold text-forest">{item.score}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {stats?.analyses_count > 0 && (
        <div className="mt-10 flex justify-center">
          <ScoreGauge score={Math.round(stats.average_score || 0)} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, suffix = '' }) {
  return (
    <div className="border-t-2 border-moss/50 pt-4">
      <p className="text-sm uppercase tracking-wide text-moss">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-forest">
        {value}
        {suffix && <span className="ml-1 text-base font-normal text-moss">{suffix}</span>}
      </p>
    </div>
  )
}
