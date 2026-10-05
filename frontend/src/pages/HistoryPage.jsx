import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Alert, EmptyState, LEVEL_LABELS, STATUS_OPTIONS, StatusBadge } from '../components/ui'

export default function HistoryPage() {
  const [data, setData] = useState({ results: [], count: 0 })
  const [filters, setFilters] = useState({ status: '', level: '', search: '', page: 1 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.listAnalyses(filters)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filters.status, filters.level, filters.page])

  const onSearch = (e) => {
    e.preventDefault()
    const next = { ...filters, page: 1 }
    setFilters(next)
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.listAnalyses(next)
        setData(res)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }

  const onDelete = async (id) => {
    if (!confirm('Supprimer cette analyse ?')) return
    await api.deleteAnalysis(id)
    load()
  }

  const onStatus = async (id, status) => {
    await api.updateStatus(id, status)
    load()
  }

  const totalPages = Math.max(1, Math.ceil((data.count || 0) / (data.page_size || 10)))

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest">Historique</h1>
          <p className="mt-1 text-moss">{data.count || 0} analyse(s) enregistrée(s).</p>
        </div>
        <Link to="/analyse" className="rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white">
          Nouvelle analyse
        </Link>
      </div>

      <form onSubmit={onSearch} className="mt-8 grid gap-3 sm:grid-cols-4">
        <input
          className="rounded-xl border border-forest/15 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-moss/30 sm:col-span-2"
          placeholder="Rechercher un titre ou une entreprise"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <select
          className="rounded-xl border border-forest/15 bg-white/70 px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
        >
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-forest/15 bg-white/70 px-3 py-2 text-sm"
          value={filters.level}
          onChange={(e) => setFilters({ ...filters, level: e.target.value, page: 1 })}
        >
          <option value="">Tous les niveaux</option>
          {Object.entries(LEVEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </form>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-moss">Chargement…</p>
      ) : !data.results?.length ? (
        <div className="mt-8">
          <EmptyState title="Aucune candidature trouvée">
            Modifiez les filtres ou lancez une nouvelle analyse.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-forest/10 border-y border-forest/10">
          {data.results.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <Link to={`/resultats/${item.id}`} className="font-semibold text-forest hover:text-coral">
                  {item.job_title}
                </Link>
                <p className="text-sm text-moss">
                  {item.company || '—'} · {LEVEL_LABELS[item.level]} ·{' '}
                  {new Date(item.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-2xl font-bold text-forest">{item.score}</span>
                <StatusBadge status={item.status} />
                <select
                  className="rounded-lg border border-forest/15 bg-white/70 px-2 py-1 text-xs"
                  value={item.status}
                  onChange={(e) => onStatus(item.id, e.target.value)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="text-xs font-medium text-coral hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            className="rounded-lg border border-forest/20 px-3 py-1 text-sm disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-sm text-moss">
            Page {filters.page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            className="rounded-lg border border-forest/20 px-3 py-1 text-sm disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  )
}
