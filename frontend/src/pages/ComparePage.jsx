import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { api, pollJob } from '../api'
import OfferUrlImport from '../components/OfferUrlImport'
import { Alert } from '../components/ui'
import { EASE, PageHeader } from '../components/motion'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { useSystemStatus } from '../context/SystemStatusContext'
import { rankJobs } from '../lib/helpers'

let offerKey = 0
const emptyOffer = () => ({ key: ++offerKey, title: '', company: '', job_offer_text: '' })
const inputClass =
  'mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-moss/30'

export default function ComparePage() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const { refresh: refreshStatus } = useSystemStatus()
  const [cvs, setCvs] = useState([])
  const [cvId, setCvId] = useState('')
  const [level, setLevel] = useState(user?.level || 'junior')
  const [offers, setOffers] = useState([emptyOffer(), emptyOffer()])
  const [jobs, setJobs] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .listCvs()
      .then((data) => {
        setCvs(data)
        if (data.length) setCvId(String(data[0].id))
      })
      .catch((err) => setError(err.message))
  }, [])

  const validOffers = offers.filter((o) => o.job_offer_text.trim().length >= 20)
  const canRun = !!cvId && validOffers.length >= 2 && !running

  const updateOffer = (key, patch) => setOffers((list) => list.map((o) => (o.key === key ? { ...o, ...patch } : o)))

  const onRun = async () => {
    setError('')
    setRunning(true)
    setJobs([])
    try {
      const res = await api.compareOffers({
        cv_id: Number(cvId),
        level,
        language: lang,
        offers: validOffers.map(({ title, company, job_offer_text }) => ({ title, company, job_offer_text })),
      })
      setJobs(res.jobs)
      await Promise.all(
        res.jobs.map((job) =>
          pollJob(job.id, (updated) => setJobs((list) => list.map((j) => (j.id === updated.id ? updated : j)))),
        ),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
      refreshStatus()
    }
  }

  const ranked = rankJobs(jobs)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t('cmp.eyebrow')} title={t('cmp.title')} subtitle={t('cmp.subtitle')} />

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="glass mt-8 grid gap-4 p-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-forest">
          {t('cmp.cv')}
          <select className={inputClass} value={cvId} onChange={(e) => setCvId(e.target.value)}>
            {cvs.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.original_filename || `CV #${cv.id}`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-forest">
          {t('wiz.level')}
          <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
            {['etudiant', 'junior', 'confirme'].map((value) => (
              <option key={value} value={value}>
                {t(`level.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 space-y-4">
        <AnimatePresence initial={false}>
          {offers.map((offer, index) => (
            <motion.div
              key={offer.key}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="glass space-y-3 p-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-forest">{t('cmp.offer', { n: index + 1 })}</h2>
                {offers.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOffers((list) => list.filter((o) => o.key !== offer.key))}
                    className="text-xs font-medium text-coral hover:underline"
                  >
                    {t('cmp.remove')}
                  </button>
                )}
              </div>
              <OfferUrlImport
                onImported={(r) =>
                  updateOffer(offer.key, {
                    title: r.title || offer.title,
                    company: r.company || offer.company,
                    job_offer_text: r.text,
                  })
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-forest">
                  {t('wiz.jobTitle')}
                  <input className={inputClass} value={offer.title} onChange={(e) => updateOffer(offer.key, { title: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-forest">
                  {t('wiz.company')}
                  <input className={inputClass} value={offer.company} onChange={(e) => updateOffer(offer.key, { company: e.target.value })} />
                </label>
              </div>
              <label className="block text-sm font-medium text-forest">
                {t('wiz.offerText')}
                <textarea
                  rows={5}
                  className={inputClass}
                  value={offer.job_offer_text}
                  placeholder={t('wiz.offerPlaceholder')}
                  onChange={(e) => updateOffer(offer.key, { job_offer_text: e.target.value })}
                />
              </label>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={offers.length >= 5}
          onClick={() => setOffers((list) => [...list, emptyOffer()])}
          className="rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest disabled:opacity-40"
        >
          {t('cmp.add')}
        </button>
        <div className="flex items-center gap-3">
          {!canRun && !running && <span className="text-xs text-moss">{t('cmp.needTwo')}</span>}
          <button
            type="button"
            disabled={!canRun}
            onClick={onRun}
            className="btn-shine rounded-xl bg-coral px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {running ? t('cmp.running') : t('cmp.run')}
          </button>
        </div>
      </div>

      {ranked.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold text-forest">{t('cmp.ranking')}</h2>
          <motion.ol layout className="mt-4 space-y-3">
            {ranked.map((job, index) => (
              <motion.li
                key={job.id}
                layout
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`glass flex flex-wrap items-center gap-4 p-4 ${index === 0 && job.state === 'done' ? 'ring-2 ring-coral/40' : ''}`}
              >
                <span className="font-display text-2xl font-bold text-leaf">#{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-forest">{job.job_title || '…'}</p>
                  <p className="text-xs text-moss">{job.company || ''}</p>
                  {job.state !== 'done' && job.state !== 'failed' && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-forest/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-coral to-mint"
                          animate={{ width: `${job.progress || 5}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-moss">{t(`wiz.step.${job.step || 'pending'}`)}</p>
                    </div>
                  )}
                  {job.state === 'failed' && <p className="text-xs text-coral">{t('cmp.failed')}{t('common.colon')}{job.error}</p>}
                </div>
                {job.state === 'done' && (
                  <>
                    <span className="font-display text-3xl font-bold text-forest">{job.score}</span>
                    <Link to={`/resultats/${job.analysis_id}`} className="text-sm font-semibold text-coral hover:underline">
                      {t('cmp.view')}
                    </Link>
                  </>
                )}
              </motion.li>
            ))}
          </motion.ol>
        </section>
      )}
    </div>
  )
}
