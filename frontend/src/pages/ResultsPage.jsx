import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, downloadCoverLetter } from '../api'
import {
  Alert,
  LEVEL_LABELS,
  STATUS_OPTIONS,
  ScoreGauge,
  SkillChips,
  StatusBadge,
} from '../components/ui'

export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  const onStatusChange = async (status) => {
    try {
      const updated = await api.updateStatus(id, status)
      setAnalysis(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  const onImprove = async () => {
    setImproveLoading(true)
    setError('')
    try {
      const data = await api.improveCv(id)
      setImprovements(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setImproveLoading(false)
    }
  }

  const onGenerateLetter = async () => {
    setLetterLoading(true)
    setError('')
    try {
      const data = await api.createCoverLetter(id, tone)
      setLetter(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLetterLoading(false)
    }
  }

  const onSaveLetter = async () => {
    if (!letter) return
    setSavingLetter(true)
    try {
      const updated = await api.updateCoverLetter(letter.id, {
        content: letter.content,
        tone: letter.tone,
      })
      setLetter(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingLetter(false)
    }
  }

  const onDelete = async () => {
    if (!confirm('Supprimer cette analyse ?')) return
    await api.deleteAnalysis(id)
    navigate('/historique')
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-12 text-moss">Chargement des résultats…</div>
  }

  if (!analysis) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert>{error || 'Analyse introuvable'}</Alert>
        <Link to="/historique" className="mt-4 inline-block text-coral">
          Retour à l’historique
        </Link>
      </div>
    )
  }

  const breakdown = analysis.score_breakdown || {}

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-moss">{LEVEL_LABELS[analysis.niveau || analysis.level]}</p>
          <h1 className="font-display text-3xl font-bold text-forest">{analysis.job_title}</h1>
          <p className="mt-1 text-moss">
            {analysis.company || 'Entreprise non renseignée'} ·{' '}
            {new Date(analysis.created_at).toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={analysis.status} />
          <select
            className="rounded-lg border border-forest/15 bg-white/70 px-2 py-1.5 text-sm"
            value={analysis.status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-coral/30 px-3 py-1.5 text-sm text-coral hover:bg-coral/10"
          >
            Supprimer
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center">
          <ScoreGauge score={analysis.score} />
          <p className="mt-3 text-center text-sm text-moss">Score de compatibilité</p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="font-display text-xl font-semibold text-forest">Détail du score</h2>
            <ul className="mt-3 space-y-2 text-sm text-moss">
              <li>
                Compétences : <strong className="text-forest">{breakdown.skills_score ?? '—'}</strong>
                {' '}(poids {(breakdown.skills_weight ?? 0) * 100 | 0}%) → contribution{' '}
                {breakdown.skills_contribution ?? '—'}
              </li>
              <li>
                Évaluation sémantique : <strong className="text-forest">{breakdown.semantic_score ?? '—'}</strong>
                {' '}(poids {(breakdown.semantic_weight ?? 0) * 100 | 0}%, ×{breakdown.level_semantic_multiplier ?? 1}) →{' '}
                {breakdown.semantic_contribution ?? '—'}
              </li>
              <li>Bonus nice-to-have : {breakdown.nice_to_have_bonus ?? 0}</li>
              {breakdown.rationale && <li className="italic">{breakdown.rationale}</li>}
            </ul>
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-forest">Compétences présentes</h2>
              <div className="mt-3">
                <SkillChips items={analysis.competences_presentes || analysis.present_skills} />
              </div>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-forest">Compétences manquantes</h2>
              <div className="mt-3">
                <SkillChips
                  items={analysis.competences_manquantes || analysis.missing_skills}
                  variant="missing"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-forest">Recommandations</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-forest">
              {(analysis.recommandations || analysis.recommendations || []).map((rec) => (
                <li key={rec}>{rec}</li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-forest">Amélioration du CV</h2>
              <button
                type="button"
                onClick={onImprove}
                disabled={improveLoading}
                className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-sand disabled:opacity-50"
              >
                {improveLoading ? 'Génération…' : 'Suggestions détaillées'}
              </button>
            </div>
            {improvements && (
              <ul className="mt-4 space-y-2 text-sm text-moss">
                {(improvements.detailed_improvements || improvements.recommandations || []).map((item) => (
                  <li key={item} className="border-l-2 border-mint pl-3">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-forest">Lettre de motivation</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-forest">
                Ton
                <select
                  className="ml-2 rounded-lg border border-forest/15 bg-white/70 px-2 py-1.5"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  <option value="formal">Formel</option>
                  <option value="dynamic">Dynamique</option>
                  <option value="concise">Concis</option>
                </select>
              </label>
              <button
                type="button"
                onClick={onGenerateLetter}
                disabled={letterLoading}
                className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {letterLoading ? 'Rédaction…' : 'Générer'}
              </button>
            </div>
            {letter && (
              <div className="mt-4 space-y-3">
                <textarea
                  rows={12}
                  className="w-full rounded-xl border border-forest/15 bg-white/80 px-3 py-3 text-sm leading-relaxed text-forest outline-none focus:ring-2 focus:ring-moss/30"
                  value={letter.content}
                  onChange={(e) => setLetter({ ...letter, content: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onSaveLetter}
                    disabled={savingLetter}
                    className="rounded-lg border border-forest/20 px-3 py-1.5 text-sm font-medium text-forest"
                  >
                    {savingLetter ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCoverLetter(letter.id, 'txt')}
                    className="rounded-lg border border-forest/20 px-3 py-1.5 text-sm font-medium text-forest"
                  >
                    Export .txt
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCoverLetter(letter.id, 'docx')}
                    className="rounded-lg border border-forest/20 px-3 py-1.5 text-sm font-medium text-forest"
                  >
                    Export .docx
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
