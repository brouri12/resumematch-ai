import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { api, pollJob } from '../api'
import { Alert, AiModeBadge, SkillChips } from '../components/ui'
import { EASE, PageHeader, Stagger, StaggerItem } from '../components/motion'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { useSystemStatus } from '../context/SystemStatusContext'
import { isValidHttpUrl, jobOfferText, scoreTone } from '../lib/helpers'
import { sourceInfo } from '../lib/sources'

const inputClass =
  'mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-moss/30'
const PHASES = ['plan', 'fetch', 'rank']
const TONE_STYLES = {
  high: 'from-leaf to-mint text-forest',
  mid: 'from-amber/70 to-amber/30 text-forest',
  low: 'from-coral/60 to-coral/20 text-forest',
}

export default function JobSearchPage() {
  const { user } = useAuth()
  const { t, lang, locale } = useI18n()
  const { refresh: refreshStatus } = useSystemStatus()
  const [cvs, setCvs] = useState([])
  const [sources, setSources] = useState([])
  const [recent, setRecent] = useState([])
  const [form, setForm] = useState({ cv_id: '', location: '', remote_only: false, custom_query: '' })
  const [selectedSources, setSelectedSources] = useState([])
  const [search, setSearch] = useState(null)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.listCvs(), api.jobSearch.sources(), api.jobSearch.list()])
      .then(([cvList, sourceList, recentList]) => {
        setCvs(cvList)
        if (cvList.length) setForm((f) => ({ ...f, cv_id: String(cvList[0].id) }))
        setSources(sourceList)
        setSelectedSources(sourceList.filter((s) => s.enabled).map((s) => s.id))
        setRecent(recentList)
        if (recentList.length) api.jobSearch.get(recentList[0].id).then(setSearch).catch(() => {})
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!running) return undefined
    const timers = [setTimeout(() => setPhase(1), 3500), setTimeout(() => setPhase(2), 9000)]
    return () => timers.forEach(clearTimeout)
  }, [running])

  const onRun = async (e) => {
    e.preventDefault()
    setError('')
    setPhase(0)
    setRunning(true)
    try {
      const result = await api.jobSearch.run({
        ...form,
        cv_id: Number(form.cv_id),
        language: lang,
        level: user?.level,
        sources: selectedSources,
      })
      setSearch(result)
      setRecent(await api.jobSearch.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
      refreshStatus()
    }
  }

  const removeSearch = async (id) => {
    await api.jobSearch.remove(id)
    setRecent((list) => list.filter((s) => s.id !== id))
    if (search?.id === id) setSearch(null)
  }

  const toggleSource = (id) =>
    setSelectedSources((list) => (list.includes(id) ? list.filter((s) => s !== id) : [...list, id]))

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t('jobs.eyebrow')} title={t('jobs.title')} subtitle={t('jobs.subtitle')} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={onRun} className="glass space-y-4 p-5">
          {cvs.length === 0 ? (
            <Alert type="info">
              {t('jobs.noCv')}{' '}
              <Link to="/analyse" className="font-semibold underline">
                {t('nav.analyze')}
              </Link>
            </Alert>
          ) : (
            <label className="block text-sm font-medium text-forest">
              {t('jobs.cv')}
              <select className={inputClass} value={form.cv_id} onChange={(e) => setForm({ ...form, cv_id: e.target.value })}>
                {cvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.original_filename || `CV #${cv.id}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-forest">
              {t('jobs.location')}
              <input
                className={inputClass}
                maxLength={100}
                placeholder={t('jobs.locationPlaceholder')}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label className="block text-sm font-medium text-forest">
              {t('jobs.customQuery')}
              <input
                className={inputClass}
                maxLength={200}
                placeholder={t('jobs.customQueryPlaceholder')}
                value={form.custom_query}
                onChange={(e) => setForm({ ...form, custom_query: e.target.value })}
              />
              <span className="mt-1 block text-xs font-normal text-moss">{t('jobs.customQueryHint')}</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-sm text-forest">
              <input
                type="checkbox"
                checked={form.remote_only}
                onChange={(e) => setForm({ ...form, remote_only: e.target.checked })}
              />
              {t('jobs.remoteOnly')}
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-forest">{t('jobs.sources')}</span>
              {sources.map((s) => (
                <label
                  key={s.id}
                  title={s.enabled ? s.url : t('jobs.sourceOff')}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
                    s.enabled ? 'border-forest/15 bg-white/60 text-forest' : 'border-dashed border-forest/15 text-moss/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!s.enabled}
                    checked={selectedSources.includes(s.id)}
                    onChange={() => toggleSource(s.id)}
                  />
                  {s.label}
                  {!s.enabled && <span className="italic">({t('jobs.sourceOff')})</span>}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-moss">{t('jobs.disclaimer')}</p>
            <button
              type="submit"
              disabled={running || !form.cv_id || selectedSources.length === 0}
              className="btn-shine rounded-xl bg-coral px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {running ? t('jobs.running') : t('jobs.run')}
            </button>
          </div>
        </form>

        <aside className="glass p-5">
          <h2 className="text-sm font-semibold text-forest">{t('jobs.recent')}</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-xs text-moss">{t('jobs.noRecent')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.map((s) => (
                <li key={s.id} className="group flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => api.jobSearch.get(s.id).then(setSearch).catch((err) => setError(err.message))}
                    className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      search?.id === s.id ? 'bg-forest text-sand' : 'text-forest hover:bg-white/60'
                    }`}
                  >
                    <span className="block truncate font-semibold">{s.target_titles.join(' · ') || '—'}</span>
                    <span className="opacity-75">
                      {new Date(s.created_at).toLocaleDateString(locale)} ·{' '}
                      {t('jobs.recentItem', { n: s.result_count, best: s.best_score ?? '—' })}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={t('common.delete')}
                    onClick={() => removeSearch(s.id)}
                    className="mt-1 text-xs text-coral opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <AnimatePresence mode="wait">
        {running ? (
          <SearchProgress key="progress" phase={phase} sourceCount={selectedSources.length} />
        ) : (
          search && <SearchResults key={search.id} search={search} cvId={search.cv || Number(form.cv_id)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function SearchProgress({ phase, sourceCount }) {
  const { t } = useI18n()
  return (
    <motion.div
      className="glass mt-8 p-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <ol className="space-y-3">
        {PHASES.map((id, index) => (
          <li key={id} className={`flex items-center gap-3 text-sm ${index <= phase ? 'text-forest' : 'text-moss/50'}`}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                index < phase ? 'bg-leaf text-white' : index === phase ? 'bg-coral text-white' : 'bg-forest/10'
              }`}
            >
              {index < phase ? '✓' : index + 1}
            </span>
            {t(`jobs.phase.${id}`, { n: sourceCount })}
            {index === phase && (
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-coral"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </li>
        ))}
      </ol>
    </motion.div>
  )
}

function SearchResults({ search, cvId }) {
  const { t } = useI18n()
  const failed = Object.entries(search.stats?.sources || {}).filter(([, s]) => s.error)

  return (
    <motion.section
      className="mt-8 space-y-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="glass space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-forest">{t('jobs.plan')}</h2>
          <div className="flex items-center gap-2">
            <AiModeBadge mode={search.ai_mode} />
            <span className="text-xs text-moss">
              {t('jobs.stats', {
                fetched: search.stats?.fetched ?? 0,
                candidates: search.stats?.candidates ?? 0,
                s: search.stats?.duration_s ?? 0,
              })}
            </span>
          </div>
        </div>
        {search.plan?.summary && <p className="text-sm italic text-moss">{search.plan.summary}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-moss">{t('jobs.targets')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(search.plan?.target_titles || []).map((title) => (
                <span key={title} className="rounded-md bg-forest px-2 py-0.5 text-xs font-medium text-sand">
                  {title}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-moss">{t('jobs.keywords')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(search.plan?.keywords || []).map((kw) => (
                <span key={kw} className="rounded-md border border-moss/20 bg-moss/10 px-2 py-0.5 text-xs text-forest">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
        {failed.length > 0 && (
          <p className="text-xs text-coral">
            {failed.map(([id]) => t('jobs.sourceError', { name: sourceInfo(id).label })).join(' · ')}
          </p>
        )}
      </div>

      <h2 className="font-display text-2xl font-semibold text-forest">
        {t('jobs.results', { n: search.results.length })}
      </h2>
      {search.results.length === 0 ? (
        <Alert type="info">{t('jobs.empty')}</Alert>
      ) : (
        <Stagger className="space-y-4" gap={0.05}>
          {search.results.map((result) => (
            <StaggerItem key={result.id}>
              <JobCard result={result} cvId={cvId} source={sourceInfo(result.source)} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </motion.section>
  )
}

function JobCard({ result, cvId, source }) {
  const sourceLabel = source.label
  const { t, lang, locale } = useI18n()
  const { user } = useAuth()
  const { refresh: refreshStatus } = useSystemStatus()
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  const tone = scoreTone(result.score)

  const analyze = async () => {
    setError('')
    setJob({ state: 'pending', progress: 0 })
    try {
      let text = jobOfferText(result)
      if (result.description.length < 400 && isValidHttpUrl(result.url)) {
        try {
          const imported = await api.importJobOffer(result.url)
          if (imported.text.length > result.description.length) text = jobOfferText({ ...result, description: imported.text })
        } catch {
          // Short description is still usable
        }
      }
      const started = await api.createAnalysisAsync({
        cv_id: cvId,
        job_offer_text: text,
        title: result.title,
        company: result.company,
        level: user?.level || 'junior',
        language: lang,
      })
      const finished = await pollJob(started.id, setJob)
      if (finished.state === 'failed') throw new Error(finished.error)
    } catch (err) {
      setJob(null)
      setError(err.message)
    } finally {
      refreshStatus()
    }
  }

  return (
    <article className="glass flex flex-col gap-4 p-5 sm:flex-row">
      <div
        className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${TONE_STYLES[tone]}`}
      >
        <span className="font-display text-2xl font-bold">{result.score}</span>
        <span className="text-[10px] uppercase tracking-wide">{t('jobs.match')}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-forest">{result.title}</h3>
          <p className="text-sm text-moss">{[result.company, result.location].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
          <span className="flex items-center gap-1 rounded-md bg-forest/10 px-2 py-0.5 text-forest">
            {source.logo && <img src={source.logo} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm object-contain" />}
            {sourceLabel}
          </span>
          {result.remote && <span className="rounded-md bg-mint/60 px-2 py-0.5 text-forest">{t('jobs.remote')}</span>}
          {result.contract && <span className="rounded-md bg-white/70 px-2 py-0.5 text-moss">{result.contract}</span>}
          {result.salary && <span className="rounded-md bg-white/70 px-2 py-0.5 text-moss">{result.salary}</span>}
          {result.published_at && (
            <span className="rounded-md bg-white/70 px-2 py-0.5 text-moss">
              {new Date(result.published_at).toLocaleDateString(locale)}
            </span>
          )}
        </div>
        {result.reason && <p className="text-sm text-forest">{result.reason}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {result.matching_skills?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-moss">{t('jobs.strengths')}</p>
              <SkillChips items={result.matching_skills} />
            </div>
          )}
          {result.missing_skills?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-moss">{t('jobs.gaps')}</p>
              <SkillChips items={result.missing_skills} variant="missing" />
            </div>
          )}
        </div>
        {result.description && (
          <details className="text-sm text-moss">
            <summary className="cursor-pointer text-xs font-semibold text-forest">{t('jobs.description')}</summary>
            <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line">{result.description.slice(0, 3000)}</p>
          </details>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
      <div className="flex shrink-0 flex-row flex-wrap gap-2 sm:w-44 sm:flex-col">
        {isValidHttpUrl(result.url) && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-forest/20 px-3 py-2 text-center text-xs font-semibold text-forest hover:bg-white/70"
          >
            {t('jobs.view', { source: sourceLabel })}
          </a>
        )}
        {job?.state === 'done' ? (
          <Link
            to={`/resultats/${job.analysis_id}`}
            className="rounded-xl bg-forest px-3 py-2 text-center text-xs font-semibold text-sand"
          >
            {t('jobs.openAnalysis')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={analyze}
            disabled={!!job}
            className="btn-shine rounded-xl bg-coral px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {job ? t('jobs.analyzing', { p: job.progress || 0 }) : t('jobs.analyze')}
          </button>
        )}
      </div>
    </article>
  )
}
