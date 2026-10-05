import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, pollJob } from '../api'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { useSystemStatus } from '../context/SystemStatusContext'
import { AnimatePresence, motion } from 'motion/react'
import OfferUrlImport from '../components/OfferUrlImport'
import { Alert } from '../components/ui'
import { EASE, PageHeader, Stagger, StaggerItem } from '../components/motion'

const LEVELS = ['etudiant', 'junior', 'confirme']

const stepVariants = {
  enter: (dir) => ({ opacity: 0, x: dir * 60, filter: 'blur(6px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: EASE } },
  exit: (dir) => ({ opacity: 0, x: dir * -60, filter: 'blur(6px)', transition: { duration: 0.3, ease: 'easeIn' } }),
}

const inputClass =
  'mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30'

export default function AnalysisWizardPage() {
  const { user } = useAuth()
  const { t, lang, locale } = useI18n()
  const { status: system, refresh: refreshStatus } = useSystemStatus()
  const navigate = useNavigate()
  const steps = t('wiz.steps').split('|')
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [cvs, setCvs] = useState([])
  const [selectedCvId, setSelectedCvId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    company: '',
    job_offer_text: '',
    level: user?.level || 'junior',
    language: lang,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [job, setJob] = useState(null)
  const [loadingCvs, setLoadingCvs] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listCvs()
        if (!cancelled) {
          setCvs(data)
          if (data.length) setSelectedCvId(data[0].id)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoadingCvs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (user?.level) setForm((f) => ({ ...f, level: user.level }))
  }, [user])

  useEffect(() => {
    setForm((f) => ({ ...f, language: lang }))
  }, [lang])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const cv = await api.uploadCv(file)
      setCvs((prev) => [cv, ...prev])
      setSelectedCvId(cv.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const canNext = () => {
    if (step === 0) return !!selectedCvId
    if (step === 1) return form.job_offer_text.trim().length >= 20
    if (step === 2) return !!form.level
    return true
  }

  const submit = async () => {
    setError('')
    setLoading(true)
    setJob(null)
    try {
      const started = await api.createAnalysisAsync({ cv_id: selectedCvId, ...form })
      setJob(started)
      const finished = await pollJob(started.id, setJob)
      if (finished.state === 'failed') throw new Error(finished.error)
      navigate(`/resultats/${finished.analysis_id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      refreshStatus()
    }
  }

  const goTo = (next) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t('wiz.eyebrow')} title={t('wiz.title')} subtitle={t('wiz.subtitle')} />

      <motion.ol
        className="relative mt-8 flex gap-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
      >
        {steps.map((label, index) => (
          <li
            key={label}
            className={`relative flex-1 overflow-hidden rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors duration-500 sm:text-sm ${
              index === step ? 'text-sand' : index < step ? 'bg-mint/60 text-forest' : 'bg-white/50 text-moss'
            }`}
          >
            {index === step && (
              <motion.span
                layoutId="wizard-step"
                className="absolute inset-0 rounded-lg bg-forest shadow-lg shadow-forest/30"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative">
              {index < step ? '✓' : index + 1}. {label}
            </span>
          </li>
        ))}
      </motion.ol>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-forest/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-coral via-leaf to-mint"
          animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </div>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="relative mt-8 min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">{t('wiz.cvTitle')}</h2>
            <motion.label
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.99 }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-moss/40 bg-white/40 px-6 py-10 backdrop-blur transition-colors hover:border-coral hover:bg-white/70"
            >
              <motion.span
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest text-xl text-mint"
                animate={uploading ? { rotate: 360 } : { y: [0, -6, 0] }}
                transition={uploading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {uploading ? '◌' : '↑'}
              </motion.span>
              <span className="font-semibold text-forest">{uploading ? t('wiz.uploading') : t('wiz.drop')}</span>
              <span className="mt-1 text-sm text-moss">{t('wiz.pdfOnly')}</span>
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onUpload} disabled={uploading} />
            </motion.label>
            {loadingCvs ? (
              <p className="text-sm text-moss">{t('wiz.loadingCvs')}</p>
            ) : cvs.length === 0 ? (
              <p className="text-sm text-moss">{t('wiz.noCv')}</p>
            ) : (
              <Stagger as="ul" className="space-y-2" gap={0.06}>
                {cvs.map((cv) => (
                  <StaggerItem as="li" key={cv.id}>
                    <motion.button
                      type="button"
                      onClick={() => setSelectedCvId(cv.id)}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        selectedCvId === cv.id
                          ? 'border-coral bg-coral/5'
                          : 'border-forest/10 bg-white/50 hover:border-moss'
                      }`}
                    >
                      <div className="font-medium text-forest">{cv.original_filename || `CV #${cv.id}`}</div>
                      <div className="text-xs text-moss">
                        {new Date(cv.uploaded_at).toLocaleString(locale)} ·{' '}
                        {(cv.parsed_data?.technical_skills || []).slice(0, 4).join(', ') || t('wiz.skillsPending')}
                      </div>
                    </motion.button>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">{t('wiz.offerTitle')}</h2>
            <OfferUrlImport
              onImported={(r) =>
                setForm((f) => ({
                  ...f,
                  title: r.title || f.title,
                  company: r.company || f.company,
                  job_offer_text: r.text,
                }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-forest">
                {t('wiz.jobTitle')}
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Développeur Python"
                />
              </label>
              <label className="block text-sm font-medium text-forest">
                {t('wiz.company')}
                <input
                  className={inputClass}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Acme"
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-forest">
              {t('wiz.offerText')}
              <textarea
                rows={10}
                className={inputClass}
                value={form.job_offer_text}
                onChange={(e) => setForm({ ...form, job_offer_text: e.target.value })}
                placeholder={t('wiz.offerPlaceholder')}
                required
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">{t('wiz.levelTitle')}</h2>
            <p className="text-sm text-moss">{t('wiz.levelHint')}</p>
            <Stagger className="grid gap-3" gap={0.08}>
              {LEVELS.map((value) => (
                <StaggerItem
                  as="button"
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, level: value })}
                  whileHover={{ scale: 1.015, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    form.level === value
                      ? 'border-coral bg-coral/5'
                      : 'border-forest/10 bg-white/50 hover:border-moss'
                  }`}
                >
                  <div className="font-semibold text-forest">{t(`level.${value}`)}</div>
                  <div className="mt-1 text-sm text-moss">{t(`wiz.level.${value}`)}</div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">{t('wiz.summary')}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">CV</dt>
                <dd className="font-medium text-forest">
                  {cvs.find((c) => c.id === selectedCvId)?.original_filename || `#${selectedCvId}`}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">{t('wiz.position')}</dt>
                <dd className="font-medium text-forest">{form.title || t('wiz.autoDetected')}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">{t('wiz.company')}</dt>
                <dd className="font-medium text-forest">{form.company || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">{t('wiz.level')}</dt>
                <dd className="font-medium text-forest">{t(`level.${form.level}`)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">{t('wiz.language')}</dt>
                <dd>
                  <select
                    className="rounded-lg border border-forest/15 bg-white/70 px-2 py-1 text-sm font-medium text-forest"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </dd>
              </div>
            </dl>
            {typeof system?.quota_remaining === 'number' && (
              <p className="text-xs text-moss">{t('quota.remaining', { n: system.quota_remaining })}</p>
            )}
          </div>
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <motion.button
          type="button"
          disabled={step === 0 || loading}
          onClick={() => goTo(step - 1)}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-white/60 disabled:opacity-40"
        >
          {t('common.back')}
        </motion.button>
        {step < 3 ? (
          <motion.button
            type="button"
            disabled={!canNext()}
            onClick={() => goTo(step + 1)}
            whileHover={canNext() ? { x: 3 } : undefined}
            whileTap={{ scale: 0.95 }}
            className="btn-shine rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand shadow-lg shadow-forest/25 disabled:opacity-40 disabled:shadow-none"
          >
            {t('common.continue')}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            disabled={loading || !canNext()}
            onClick={submit}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            animate={loading ? {} : { boxShadow: ['0 0 0 0 rgba(14,124,102,0.5)', '0 0 0 14px rgba(14,124,102,0)'] }}
            transition={{ boxShadow: { duration: 1.6, repeat: Infinity } }}
            className="btn-shine rounded-xl bg-coral px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {loading ? t('wiz.running') : t('wiz.launch')}
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex w-full max-w-sm flex-col items-center px-6 text-center text-sand"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <div className="relative h-24 w-24">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute inset-0 rounded-full border border-mint/60"
                    animate={{ scale: [0.6, 1.8], opacity: [0.9, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
                  />
                ))}
                <motion.span
                  className="absolute inset-6 rounded-full bg-gradient-to-br from-mint to-coral"
                  animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                  transition={{ rotate: { duration: 4, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.5, repeat: Infinity } }}
                />
              </div>
              <p className="mt-8 font-display text-2xl font-bold">{t('wiz.overlay')}</p>
              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-sand/20">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-mint to-coral"
                  animate={{ width: `${Math.max(5, job?.progress || 0)}%` }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              </div>
              <div className="mt-2 flex w-full justify-between text-sm text-mint">
                <span>{t(`wiz.step.${job?.step || 'pending'}`)}</span>
                <span>{job?.progress || 0}%</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
