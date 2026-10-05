import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, downloadCoverLetter, downloadReport } from '../api'
import { AiModeBadge, Alert, ScoreGauge, SkillChips, StatusBadge } from '../components/ui'
import { AtsSection, InterviewSection, LearningPlanSection, RewriteSection } from '../components/ResultExtras'
import { useI18n } from '../context/I18nContext'
import { STATUS_ORDER } from '../lib/helpers'
import { motion } from 'motion/react'
import { CountUp, EASE, Loader, PageHeader, Reveal, Stagger, StaggerItem } from '../components/motion'

function ScoreBar({ label, value, delay = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-moss">{label}</span>
        <CountUp value={pct} className="font-semibold text-forest" />
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-forest/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-coral via-leaf to-mint"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 0.2 + delay, ease: EASE }}
        />
      </div>
    </div>
  )
}

const outlineBtn = 'rounded-lg border border-forest/20 px-3 py-1.5 text-sm font-medium text-forest hover:bg-white/60'

export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang, locale } = useI18n()
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [improvements, setImprovements] = useState(null)
  const [improveLoading, setImproveLoading] = useState(false)
  const [letter, setLetter] = useState(null)
  const [tone, setTone] = useState('formal')
  const [letterLoading, setLetterLoading] = useState(false)
  const [savingLetter, setSavingLetter] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAnalysis(id)
      setAnalysis(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const run = async (fn) => {
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.message || t('res.exportFailed'))
    }
  }

  const onStatusChange = (status) => run(async () => setAnalysis(await api.updateStatus(id, status)))

  const onImprove = async () => {
    setImproveLoading(true)
    await run(async () => setImprovements(await api.improveCv(id, lang)))
    setImproveLoading(false)
  }

  const onGenerateLetter = async () => {
    setLetterLoading(true)
    await run(async () => setLetter(await api.createCoverLetter(id, tone, lang)))
    setLetterLoading(false)
  }

  const onSaveLetter = async () => {
    if (!letter) return
    setSavingLetter(true)
    await run(async () =>
      setLetter(await api.updateCoverLetter(letter.id, { content: letter.content, tone: letter.tone })),
    )
    setSavingLetter(false)
  }

  const onDelete = async () => {
    if (!confirm(t('res.confirmDelete'))) return
    await api.deleteAnalysis(id)
    navigate('/historique')
  }

  if (loading) {
    return <Loader label={t('res.loading')} />
  }

  if (!analysis) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert>{error || t('res.notFound')}</Alert>
        <Link to="/historique" className="mt-4 inline-block text-coral">
          {t('res.backHistory')}
        </Link>
      </div>
    )
  }

  const breakdown = analysis.score_breakdown || {}

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow={t(`level.${analysis.niveau || analysis.level}`)}
          title={analysis.job_title || 'Analyse'}
          subtitle={`${analysis.company || t('common.companyUnknown')} · ${new Date(analysis.created_at).toLocaleString(locale)}`}
        />
        <motion.div
          className="no-print flex flex-wrap items-center gap-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
        >
          <StatusBadge status={analysis.status} />
          <select
            className="rounded-lg border border-forest/15 bg-white/70 px-2 py-1.5 text-sm"
            value={analysis.status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => run(() => downloadReport(id, lang))} className={outlineBtn}>
            {t('res.exportReport')}
          </button>
          <button type="button" onClick={() => window.print()} className={outlineBtn}>
            {t('res.print')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-coral/30 px-3 py-1.5 text-sm text-coral hover:bg-coral/10"
          >
            {t('common.delete')}
          </button>
        </motion.div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center gap-3 lg:sticky lg:top-24">
          <ScoreGauge score={analysis.score} size={170} />
          <motion.p
            className="text-center text-sm text-moss"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {t('res.scoreLabel')}
          </motion.p>
          <AiModeBadge mode={analysis.ai_mode} />
        </div>

        <div className="space-y-12">
          <Reveal as="section" className="glass p-6">
            <h2 className="font-display text-xl font-semibold text-forest">{t('res.breakdown')}</h2>
            <div className="mt-4 space-y-3">
              <ScoreBar label={t('res.skills')} value={breakdown.skills_score} />
              <ScoreBar label={t('res.semantic')} value={breakdown.semantic_score} delay={0.15} />
            </div>
            <ul className="mt-3 space-y-2 text-sm text-moss">
              <li>
                {t('res.skills')}{t('common.colon')}<strong className="text-forest">{breakdown.skills_score ?? '—'}</strong>
                {' '}({t('res.weight')} {(breakdown.skills_weight ?? 0) * 100 | 0}%) → {t('res.contribution')}{' '}
                {breakdown.skills_contribution ?? '—'}
              </li>
              <li>
                {t('res.semantic')}{t('common.colon')}<strong className="text-forest">{breakdown.semantic_score ?? '—'}</strong>
                {' '}({t('res.weight')} {(breakdown.semantic_weight ?? 0) * 100 | 0}%, ×{breakdown.level_semantic_multiplier ?? 1}) →{' '}
                {breakdown.semantic_contribution ?? '—'}
              </li>
              <li>{t('res.niceBonus')}{t('common.colon')}{breakdown.nice_to_have_bonus ?? 0}</li>
              {breakdown.rationale && <li className="italic">{breakdown.rationale}</li>}
            </ul>
          </Reveal>

          <Reveal as="section" className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-forest">{t('res.present')}</h2>
              <div className="mt-3">
                <SkillChips items={analysis.competences_presentes || analysis.present_skills} />
              </div>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-forest">{t('res.missing')}</h2>
              <div className="mt-3">
                <SkillChips items={analysis.competences_manquantes || analysis.missing_skills} variant="missing" />
              </div>
            </div>
          </Reveal>

          <Reveal as="section">
            <h2 className="font-display text-xl font-semibold text-forest">{t('res.recs')}</h2>
            <Stagger as="ul" inView className="mt-3 space-y-2 text-sm text-forest" gap={0.1}>
              {(analysis.recommandations || analysis.recommendations || []).map((rec, i) => (
                <StaggerItem
                  as="li"
                  key={rec}
                  whileHover={{ x: 6 }}
                  className="flex gap-3 rounded-xl border border-forest/10 bg-white/50 px-4 py-3 backdrop-blur"
                >
                  <span className="font-display font-bold text-leaf">{String(i + 1).padStart(2, '0')}</span>
                  <span>{rec}</span>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>

          <AtsSection analysisId={id} />
          <RewriteSection analysisId={id} />

          <Reveal as="section">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-forest">{t('res.improve')}</h2>
              <button
                type="button"
                onClick={onImprove}
                disabled={improveLoading}
                className="no-print rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-sand disabled:opacity-50"
              >
                {improveLoading ? t('common.generating') : t('res.improveBtn')}
              </button>
            </div>
            {improvements && (
              <Stagger as="ul" className="mt-4 space-y-2 text-sm text-moss" gap={0.08}>
                {(improvements.detailed_improvements || improvements.recommandations || []).map((item) => (
                  <StaggerItem as="li" key={item} className="border-l-2 border-mint pl-3">
                    {item}
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </Reveal>

          <InterviewSection analysisId={id} />
          <LearningPlanSection analysisId={id} />

          <Reveal as="section">
            <h2 className="font-display text-xl font-semibold text-forest">{t('res.letter')}</h2>
            <div className="no-print mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-forest">
                {t('res.tone')}
                <select
                  className="ml-2 rounded-lg border border-forest/15 bg-white/70 px-2 py-1.5"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  {['formal', 'dynamic', 'concise'].map((value) => (
                    <option key={value} value={value}>
                      {t(`res.tone.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={onGenerateLetter}
                disabled={letterLoading}
                className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {letterLoading ? t('res.writing') : t('common.generate')}
              </button>
            </div>
            {letter && (
              <motion.div
                className="mt-4 space-y-3"
                initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, ease: EASE }}
              >
                <textarea
                  rows={12}
                  className="w-full rounded-xl border border-forest/15 bg-white/80 px-3 py-3 text-sm leading-relaxed text-forest outline-none focus:ring-2 focus:ring-moss/30"
                  value={letter.content}
                  onChange={(e) => setLetter({ ...letter, content: e.target.value })}
                />
                <div className="no-print flex flex-wrap gap-2">
                  <button type="button" onClick={onSaveLetter} disabled={savingLetter} className={outlineBtn}>
                    {savingLetter ? t('res.saving') : t('res.save')}
                  </button>
                  <button type="button" onClick={() => run(() => downloadCoverLetter(letter.id, 'txt'))} className={outlineBtn}>
                    Export .txt
                  </button>
                  <button type="button" onClick={() => run(() => downloadCoverLetter(letter.id, 'docx'))} className={outlineBtn}>
                    Export .docx
                  </button>
                </div>
              </motion.div>
            )}
          </Reveal>
        </div>
      </div>
    </div>
  )
}
