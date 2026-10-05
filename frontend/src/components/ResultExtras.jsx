import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../api'
import { useI18n } from '../context/I18nContext'
import { isValidHttpUrl, totalLearningWeeks } from '../lib/helpers'
import { EASE, Reveal, Stagger, StaggerItem } from './motion'
import { AiModeBadge, Alert, ScoreGauge, SkillChips } from './ui'

function useExtra(analysisId, kind, lang) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    api
      .getExtra(analysisId, kind, lang)
      .then((res) => !cancelled && setData(res.data))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [analysisId, kind, lang])

  const generate = useCallback(
    async (refresh = false) => {
      setLoading(true)
      setError('')
      try {
        const res = await api.generateExtra(analysisId, kind, lang, refresh)
        setData(res.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [analysisId, kind, lang],
  )

  return { data, loading, error, generate }
}

function ExtraSection({ analysisId, kind, title, hint, actionLabel, children }) {
  const { lang, t } = useI18n()
  const { data, loading, error, generate } = useExtra(analysisId, kind, lang)

  return (
    <Reveal as="section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold text-forest">{title}</h2>
            <AiModeBadge mode={data?.ai_mode} />
          </div>
          <p className="mt-1 text-sm text-moss">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => generate(!!data)}
          disabled={loading}
          className="no-print rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-sand disabled:opacity-50"
        >
          {loading ? t('common.generating') : data ? t('common.regenerate') : actionLabel || t('common.generate')}
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <AnimatePresence mode="wait">
        {data && (
          <motion.div
            key={JSON.stringify(data).length}
            className="mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {children(data)}
          </motion.div>
        )}
      </AnimatePresence>
    </Reveal>
  )
}

function CopyButton({ text }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      className="no-print shrink-0 rounded-lg border border-forest/20 px-2.5 py-1 text-xs font-medium text-forest hover:bg-white/70"
    >
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  )
}

const CHECK_STYLES = {
  ok: { icon: '✓', className: 'bg-mint/50 text-forest' },
  warn: { icon: '!', className: 'bg-amber/25 text-forest' },
  fail: { icon: '✕', className: 'bg-coral/15 text-coral' },
}

export function AtsSection({ analysisId }) {
  const { t } = useI18n()
  return (
    <ExtraSection
      analysisId={analysisId}
      kind="ats"
      title={t('ats.title')}
      hint={t('ats.hint')}
      actionLabel={t('ats.run')}
    >
      {(data) => (
        <div className="glass grid gap-6 p-6 sm:grid-cols-[140px_1fr]">
          <div className="flex justify-center">
            <ScoreGauge score={data.score} size={130} />
          </div>
          <div>
            <ul className="space-y-2">
              {data.checks.map((check) => {
                const style = CHECK_STYLES[check.status] || CHECK_STYLES.warn
                return (
                  <li key={check.id} className="flex gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.className}`}
                    >
                      {style.icon}
                    </span>
                    <span>
                      <strong className="text-forest">{check.label}</strong>
                      <span className="text-moss"> — {check.detail}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            {data.keywords?.missing?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-forest">{t('ats.missingKw')}</p>
                <SkillChips items={data.keywords.missing} variant="missing" />
              </div>
            )}
          </div>
        </div>
      )}
    </ExtraSection>
  )
}

export function RewriteSection({ analysisId }) {
  const { t } = useI18n()
  return (
    <ExtraSection analysisId={analysisId} kind="cv_rewrite" title={t('rw.title')} hint={t('rw.hint')}>
      {(data) => (
        <Stagger as="ul" className="space-y-4" gap={0.08}>
          {data.items.map((item, i) => (
            <StaggerItem as="li" key={`${i}-${item.after.slice(0, 20)}`} className="glass p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-leaf">{item.section}</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {item.before && (
                  <div className="rounded-xl border border-forest/10 bg-white/40 p-3">
                    <p className="text-xs font-semibold text-moss">{t('rw.before')}</p>
                    <p className="mt-1 text-sm text-moss line-through decoration-coral/40">{item.before}</p>
                  </div>
                )}
                <div className={`rounded-xl border border-mint bg-mint/20 p-3 ${item.before ? '' : 'md:col-span-2'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-forest">{t('rw.after')}</p>
                    <CopyButton text={item.after} />
                  </div>
                  <p className="mt-1 text-sm text-forest">{item.after}</p>
                </div>
              </div>
              {item.reason && <p className="mt-2 text-xs italic text-moss">{item.reason}</p>}
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </ExtraSection>
  )
}

const CATEGORY_STYLES = {
  technique: 'bg-leaf/15',
  comportementale: 'bg-mint/40',
  motivation: 'bg-amber/20',
  lacune: 'bg-coral/15 text-coral',
}

function InterviewQuestion({ q, index }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(index === 0)
  return (
    <li className="rounded-xl border border-forest/10 bg-white/50 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="font-display font-bold text-leaf">{String(index + 1).padStart(2, '0')}</span>
        <span className="flex-1 text-sm font-medium text-forest">{q.question}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[q.category] || 'bg-forest/10'}`}>
          {t(`iv.cat.${q.category}`)}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-moss">
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-4 pb-4 pl-12 text-sm">
              {q.why && (
                <p>
                  <strong className="text-forest">{t('iv.why')}{t('common.colon')}</strong>
                  <span className="text-moss">{q.why}</span>
                </p>
              )}
              {q.answer_tips && (
                <p>
                  <strong className="text-forest">{t('iv.tips')}{t('common.colon')}</strong>
                  <span className="text-moss">{q.answer_tips}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function InterviewSection({ analysisId }) {
  const { t } = useI18n()
  return (
    <ExtraSection analysisId={analysisId} kind="interview_prep" title={t('iv.title')} hint={t('iv.hint')}>
      {(data) => (
        <ul className="space-y-2">
          {data.questions.map((q, i) => (
            <InterviewQuestion key={`${i}-${q.question}`} q={q} index={i} />
          ))}
        </ul>
      )}
    </ExtraSection>
  )
}

const PRIORITY_STYLES = {
  haute: 'bg-coral/15 text-coral',
  moyenne: 'bg-amber/20 text-forest',
  basse: 'bg-mint/40 text-forest',
}

export function LearningPlanSection({ analysisId }) {
  const { t } = useI18n()
  return (
    <ExtraSection analysisId={analysisId} kind="learning_plan" title={t('lp.title')} hint={t('lp.hint')}>
      {(data) =>
        !data.steps.length ? (
          <p className="text-sm text-moss">{t('lp.none')}</p>
        ) : (
          <>
            <p className="mb-3 text-sm font-medium text-forest">
              {t('lp.total', { n: totalLearningWeeks(data.steps) })}
            </p>
            <ol className="relative space-y-4 border-l-2 border-mint pl-6">
              {data.steps.map((step, i) => (
                <li key={`${i}-${step.skill}`} className="relative">
                  <span className="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-forest ring-4 ring-sand" />
                  <div className="glass p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-forest">{step.skill}</h3>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[step.priority]}`}>
                        {t(`lp.priority.${step.priority}`)}
                      </span>
                      <span className="text-xs text-moss">{t('common.weeks', { n: step.estimated_weeks })}</span>
                    </div>
                    {step.resources?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {step.resources.map((r) => (
                          <li key={r.title}>
                            {isValidHttpUrl(r.url) ? (
                              <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-coral hover:underline">
                                {r.title}
                              </a>
                            ) : (
                              <span className="text-forest">{r.title}</span>
                            )}
                            <span className="text-xs text-moss"> · {r.kind}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {step.project_idea && (
                      <p className="mt-2 text-sm text-moss">
                        <strong className="text-forest">{t('lp.project')}{t('common.colon')}</strong>
                        {step.project_idea}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )
      }
    </ExtraSection>
  )
}
