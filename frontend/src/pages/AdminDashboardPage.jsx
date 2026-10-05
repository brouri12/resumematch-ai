import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { api } from '../api'
import { Alert, StatusBadge } from '../components/ui'
import { CountUp, EASE, Loader, PageHeader, Stagger, StaggerItem } from '../components/motion'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { useSystemStatus } from '../context/SystemStatusContext'
import { STATUS_ORDER } from '../lib/helpers'

const TABS = ['overview', 'users', 'analyses', 'jobs', 'settings']
const LEVELS = ['etudiant', 'junior', 'confirme']
const inputClass =
  'rounded-xl border border-forest/15 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-moss/30'
const smallBtn = 'rounded-lg border border-forest/20 px-2.5 py-1 text-xs font-medium text-forest hover:bg-white/70'

export default function AdminDashboardPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState('overview')

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t('adm.eyebrow')} title={t('adm.title')} subtitle={t('adm.subtitle')} />
      <div className="mt-8 flex flex-wrap gap-2 border-b border-forest/10" role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`relative px-4 py-2 text-sm font-semibold transition-colors ${
              tab === id ? 'text-coral' : 'text-forest/70 hover:text-forest'
            }`}
          >
            {t(`adm.tab.${id}`)}
            {tab === id && (
              <motion.span
                layoutId="admin-tab"
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-coral to-leaf"
              />
            )}
          </button>
        ))}
      </div>
      <motion.div
        key={tab}
        className="mt-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'analyses' && <AnalysesTab />}
        {tab === 'jobs' && <JobsTab />}
        {tab === 'settings' && <SettingsTab />}
      </motion.div>
    </div>
  )
}

function usePaged(fetcher, filters) {
  const [data, setData] = useState({ results: [], count: 0, page: 1, page_size: 20 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const key = JSON.stringify(filters)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetcher(JSON.parse(key)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetcher, key])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, setError, reload }
}

function Pager({ data, onPage }) {
  const { t } = useI18n()
  const total = Math.max(1, Math.ceil((data.count || 0) / (data.page_size || 20)))
  if (total <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button type="button" className={smallBtn} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
        {t('adm.prev')}
      </button>
      <span className="text-moss">{t('adm.page', { p: data.page, t: total })}</span>
      <button type="button" className={smallBtn} disabled={data.page >= total} onClick={() => onPage(data.page + 1)}>
        {t('adm.next')}
      </button>
    </div>
  )
}

function Table({ head, children, empty }) {
  const { t } = useI18n()
  return (
    <div className="glass overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-forest/10 text-xs uppercase tracking-wide text-moss">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-forest/5">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-sm text-moss">{t('adm.empty')}</p>}
    </div>
  )
}

function KpiCard({ label, value, detail, decimals = 0 }) {
  return (
    <StaggerItem className="glass p-5">
      <p className="text-xs uppercase tracking-wide text-moss">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-forest">
        <CountUp value={value} decimals={decimals} />
      </p>
      {detail && <p className="mt-1 text-xs text-moss">{detail}</p>}
    </StaggerItem>
  )
}

function Breakdown({ title, entries }) {
  const max = Math.max(1, ...entries.map((e) => e.value))
  return (
    <div className="glass p-5">
      <h3 className="text-sm font-semibold text-forest">{title}</h3>
      <ul className="mt-3 space-y-2">
        {entries.map((e) => (
          <li key={e.label} className="text-xs">
            <div className="flex justify-between text-moss">
              <span>{e.label}</span>
              <span className="font-semibold text-forest">{e.value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forest/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-coral to-mint"
                initial={{ width: 0 }}
                animate={{ width: `${(e.value / max) * 100}%` }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OverviewTab() {
  const { t, locale } = useI18n()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.admin.overview().then(setData).catch((err) => setError(err.message))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!data) return <Loader />

  const perDayMax = Math.max(1, ...data.analyses.per_day.map((d) => d.count))
  const llm = data.llm

  return (
    <div className="space-y-6">
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.08}>
        <KpiCard
          label={t('adm.users')}
          value={data.users.total}
          detail={t('adm.usersActive', { n: data.users.active, s: data.users.staff, w: data.users.new_7d })}
        />
        <KpiCard label={t('adm.analyses')} value={data.analyses.total} detail={t('adm.analyses24', { n: data.analyses.last_24h })} />
        <KpiCard label={t('adm.avgScore')} value={data.analyses.average_score} decimals={1} />
        <KpiCard
          label={t('adm.content')}
          value={data.cvs + data.job_offers + data.cover_letters}
          detail={t('adm.contentDetail', { cv: data.cvs, offers: data.job_offers, letters: data.cover_letters })}
        />
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-forest">{t('adm.perDay')}</h3>
          <div className="mt-4 flex h-40 items-end gap-1.5">
            {data.analyses.per_day.map((d, i) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <motion.div
                  className="rounded-t-md bg-gradient-to-t from-leaf to-mint"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.count / perDayMax) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.03, ease: EASE }}
                  style={{ minHeight: d.count ? 4 : 0 }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-forest px-1.5 py-0.5 text-[10px] text-sand group-hover:block">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-moss">
            <span>{new Date(data.analyses.per_day[0].day).toLocaleDateString(locale)}</span>
            <span>{new Date(data.analyses.per_day.at(-1).day).toLocaleDateString(locale)}</span>
          </div>
        </div>

        <div className="glass space-y-2 p-5 text-sm">
          <h3 className="font-semibold text-forest">{t('adm.ai')}</h3>
          <p>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                llm.mode === 'live' ? 'bg-mint text-forest' : 'bg-amber/25 text-forest'
              }`}
            >
              {t(`adm.ai.${llm.mode}`)}
            </span>{' '}
            <span className="text-moss">
              {llm.provider} · {llm.model}
            </span>
          </p>
          {llm.forced_mock && <p className="text-xs text-coral">{t('adm.ai.forced')}</p>}
          {!llm.has_api_key && <p className="text-xs text-coral">{t('adm.ai.noKey')}</p>}
          <p className="text-xs text-moss">{t('adm.cache', { n: data.cache_entries })}</p>
          <p className="text-xs text-moss">
            {t('adm.jobsSummary', { running: data.jobs.running + data.jobs.pending, failed: data.jobs.failed })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Breakdown
          title={t('adm.byStatus')}
          entries={STATUS_ORDER.map((s) => ({ label: t(`status.${s}`), value: data.analyses.by_status[s] || 0 }))}
        />
        <Breakdown
          title={t('adm.byLevel')}
          entries={LEVELS.map((l) => ({ label: t(`level.${l}`), value: data.analyses.by_level[l] || 0 }))}
        />
        <Breakdown
          title={t('adm.byAiMode')}
          entries={Object.entries(data.analyses.by_ai_mode).map(([mode, value]) => ({
            label: t(`adm.ai.${mode}`),
            value,
          }))}
        />
        <Breakdown
          title={t('adm.topMissing')}
          entries={data.top_missing_skills.map((s) => ({ label: s.skill, value: s.count }))}
        />
      </div>
    </div>
  )
}

function UsersTab() {
  const { t, locale } = useI18n()
  const { user: me } = useAuth()
  const [filters, setFilters] = useState({ search: '', role: '', page: 1 })
  const [search, setSearch] = useState('')
  const { data, loading, error, setError, reload } = usePaged(api.admin.users, filters)

  const update = async (id, payload) => {
    try {
      await api.admin.updateUser(id, payload)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (u) => {
    if (!confirm(t('adm.confirmDeleteUser', { name: u.username }))) return
    try {
      await api.admin.deleteUser(u.id)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setFilters({ ...filters, search, page: 1 })
        }}
      >
        <input className={`${inputClass} flex-1`} placeholder={t('adm.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}>
          <option value="">{t('adm.all')}</option>
          <option value="staff">{t('adm.role.staff')}</option>
          <option value="inactive">{t('adm.role.inactive')}</option>
        </select>
      </form>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Loader />
      ) : (
        <Table
          head={[t('adm.col.user'), t('adm.col.level'), t('adm.col.activity'), t('adm.col.joined'), t('adm.active'), t('adm.staff'), '']}
          empty={!data.results.length}
        >
          {data.results.map((u) => {
            const isMe = u.id === me?.id
            return (
              <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-forest">
                    {u.username}
                    {u.is_superuser && (
                      <span className="ml-2 rounded bg-forest px-1.5 py-0.5 text-[10px] font-semibold text-sand">{t('adm.superuser')}</span>
                    )}
                  </div>
                  <div className="text-xs text-moss">
                    {[u.first_name, u.last_name].filter(Boolean).join(' ')} {u.email && `· ${u.email}`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select className="rounded-lg border border-forest/10 bg-white/70 px-2 py-1 text-xs" value={u.level} onChange={(e) => update(u.id, { level: e.target.value })}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {t(`level.${l}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-moss">
                  {t('adm.activity', { a: u.analyses_count, c: u.cvs_count })}
                  {u.average_score != null && <span className="ml-1 font-semibold text-forest">· Ø {Math.round(u.average_score)}</span>}
                </td>
                <td className="px-4 py-3 text-xs text-moss">{new Date(u.date_joined).toLocaleDateString(locale)}</td>
                <td className="px-4 py-3">
                  <input type="checkbox" aria-label={t('adm.active')} checked={u.is_active} disabled={isMe} onChange={(e) => update(u.id, { is_active: e.target.checked })} />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" aria-label={t('adm.staff')} checked={u.is_staff} disabled={isMe} onChange={(e) => update(u.id, { is_staff: e.target.checked })} />
                </td>
                <td className="px-4 py-3 text-right">
                  {!isMe && (
                    <button type="button" onClick={() => remove(u)} className="text-xs font-medium text-coral hover:underline">
                      {t('common.delete')}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
      )}
      <Pager data={data} onPage={(page) => setFilters({ ...filters, page })} />
    </div>
  )
}

function AnalysesTab() {
  const { t, locale } = useI18n()
  const [filters, setFilters] = useState({ search: '', status: '', level: '', ai_mode: '', page: 1 })
  const [search, setSearch] = useState('')
  const { data, loading, error, setError, reload } = usePaged(api.admin.analyses, filters)

  const remove = async (id) => {
    if (!confirm(t('adm.confirmDeleteAnalysis'))) return
    try {
      await api.admin.deleteAnalysis(id)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const set = (patch) => setFilters({ ...filters, ...patch, page: 1 })

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          set({ search })
        }}
      >
        <input className={`${inputClass} flex-1`} placeholder={t('adm.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">{t('adm.col.status')} : {t('adm.all')}</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select className={inputClass} value={filters.level} onChange={(e) => set({ level: e.target.value })}>
          <option value="">{t('adm.col.level')} : {t('adm.all')}</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`level.${l}`)}
            </option>
          ))}
        </select>
        <select className={inputClass} value={filters.ai_mode} onChange={(e) => set({ ai_mode: e.target.value })}>
          <option value="">{t('adm.col.ai')} : {t('adm.all')}</option>
          {['live', 'mock', 'mixed'].map((m) => (
            <option key={m} value={m}>
              {t(`adm.ai.${m}`)}
            </option>
          ))}
        </select>
      </form>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Loader />
      ) : (
        <Table
          head={[t('adm.col.offer'), t('adm.col.user'), t('adm.col.score'), t('adm.col.status'), t('adm.col.ai'), t('adm.col.date'), '']}
          empty={!data.results.length}
        >
          {data.results.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-3">
                <div className="font-semibold text-forest">{a.job_title}</div>
                <div className="text-xs text-moss">
                  {a.company || '—'} · {t(`level.${a.level}`)}
                </div>
              </td>
              <td className="px-4 py-3 text-moss">{a.username}</td>
              <td className="px-4 py-3 font-display text-lg font-bold text-forest">{a.score}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-4 py-3 text-xs text-moss">{t(`adm.ai.${a.ai_mode || 'unknown'}`)}</td>
              <td className="px-4 py-3 text-xs text-moss">{new Date(a.created_at).toLocaleDateString(locale)}</td>
              <td className="px-4 py-3 text-right">
                <button type="button" onClick={() => remove(a.id)} className="text-xs font-medium text-coral hover:underline">
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Pager data={data} onPage={(page) => setFilters({ ...filters, page })} />
    </div>
  )
}

const JOB_STYLES = {
  pending: 'bg-forest/10',
  running: 'bg-amber/25',
  done: 'bg-mint',
  failed: 'bg-coral/15 text-coral',
}

function JobsTab() {
  const { t, locale } = useI18n()
  const [filters, setFilters] = useState({ state: '', page: 1 })
  const [message, setMessage] = useState('')
  const { data, loading, error, setError, reload } = usePaged(api.admin.jobs, filters)

  const purge = async () => {
    try {
      const res = await api.admin.purgeJobs()
      setMessage(t('adm.purged', { n: res.deleted }))
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select className={inputClass} value={filters.state} onChange={(e) => setFilters({ state: e.target.value, page: 1 })}>
          <option value="">{t('adm.all')}</option>
          {['pending', 'running', 'done', 'failed'].map((s) => (
            <option key={s} value={s}>
              {t(`adm.job.${s}`)}
            </option>
          ))}
        </select>
        <button type="button" onClick={purge} className={smallBtn}>
          {t('adm.purgeJobs')}
        </button>
      </div>
      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Loader />
      ) : (
        <Table head={['#', t('adm.col.user'), t('adm.col.state'), t('adm.col.error'), t('adm.col.date'), '']} empty={!data.results.length}>
          {data.results.map((j) => (
            <tr key={j.id}>
              <td className="px-4 py-3 text-moss">{j.id}</td>
              <td className="px-4 py-3 text-forest">{j.username}</td>
              <td className="px-4 py-3">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${JOB_STYLES[j.state]}`}>
                  {t(`adm.job.${j.state}`)} · {j.progress}%
                </span>
              </td>
              <td className="max-w-md px-4 py-3 text-xs text-moss">{j.error || t(`wiz.step.${j.step || 'pending'}`)}</td>
              <td className="px-4 py-3 text-xs text-moss">{new Date(j.created_at).toLocaleString(locale)}</td>
              <td className="px-4 py-3 text-right">
                {j.analysis_id && (
                  <Link to={`/resultats/${j.analysis_id}`} className="text-xs font-semibold text-coral hover:underline">
                    →
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Pager data={data} onPage={(page) => setFilters({ ...filters, page })} />
    </div>
  )
}

function SettingsTab() {
  const { t } = useI18n()
  const { refresh: refreshStatus } = useSystemStatus()
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.admin
      .settings()
      .then((s) => setForm({ ...s, analysis_daily_quota: s.analysis_daily_quota ?? '' }))
      .catch((err) => setMessage({ type: 'error', text: err.message }))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const saved = await api.admin.updateSettings({
        analysis_daily_quota: form.analysis_daily_quota === '' ? null : Number(form.analysis_daily_quota),
        force_mock_ai: form.force_mock_ai,
        allow_registration: form.allow_registration,
        announcement: form.announcement,
      })
      setForm({ ...saved, analysis_daily_quota: saved.analysis_daily_quota ?? '' })
      setMessage({ type: 'success', text: t('adm.set.saved') })
      refreshStatus()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const clearCache = async () => {
    try {
      const res = await api.admin.clearCache()
      setMessage({ type: 'success', text: t('adm.purged', { n: res.deleted }) })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  if (!form) return message ? <Alert>{message.text}</Alert> : <Loader />

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <form onSubmit={save} className="glass space-y-5 p-6">
        <label className="block text-sm font-medium text-forest">
          {t('adm.set.quota')}
          <input
            type="number"
            min="0"
            className={`${inputClass} mt-1 block w-40`}
            value={form.analysis_daily_quota}
            onChange={(e) => setForm({ ...form, analysis_daily_quota: e.target.value })}
          />
          <span className="mt-1 block text-xs font-normal text-moss">
            {t('adm.set.quotaHint', { n: form.analysis_daily_quota === '' ? form.effective_daily_quota : '…' })}
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm text-forest">
          <input type="checkbox" checked={form.force_mock_ai} onChange={(e) => setForm({ ...form, force_mock_ai: e.target.checked })} />
          {t('adm.set.forceMock')}
        </label>
        <label className="flex items-center gap-3 text-sm text-forest">
          <input
            type="checkbox"
            checked={form.allow_registration}
            onChange={(e) => setForm({ ...form, allow_registration: e.target.checked })}
          />
          {t('adm.set.registration')}
        </label>
        <label className="block text-sm font-medium text-forest">
          {t('adm.set.announcement')}
          <input
            className={`${inputClass} mt-1 block w-full`}
            maxLength={300}
            value={form.announcement}
            onChange={(e) => setForm({ ...form, announcement: e.target.value })}
          />
          <span className="mt-1 block text-xs font-normal text-moss">{t('adm.set.announcementHint')}</span>
        </label>
        {message && <Alert type={message.type}>{message.text}</Alert>}
        <button type="submit" disabled={saving} className="btn-shine rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-50">
          {saving ? t('res.saving') : t('adm.set.save')}
        </button>
      </form>

      <div className="glass space-y-3 p-6">
        <h3 className="text-sm font-semibold text-forest">{t('adm.set.maintenance')}</h3>
        <button type="button" onClick={clearCache} className={`${smallBtn} block w-full py-2 text-left`}>
          {t('adm.set.clearCache')}
        </button>
        <a href="/admin/" target="_blank" rel="noreferrer" className={`${smallBtn} block w-full py-2`}>
          {t('adm.set.djangoAdmin')} ↗
        </a>
      </div>
    </div>
  )
}
