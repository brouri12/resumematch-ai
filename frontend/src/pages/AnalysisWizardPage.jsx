import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { Alert, LEVEL_LABELS } from '../components/ui'

const STEPS = ['CV', 'Offre', 'Niveau', 'Lancement']

export default function AnalysisWizardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [cvs, setCvs] = useState([])
  const [selectedCvId, setSelectedCvId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    company: '',
    job_offer_text: '',
    level: user?.level || 'junior',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    try {
      const result = await api.createAnalysis({
        cv_id: selectedCvId,
        job_offer_text: form.job_offer_text,
        title: form.title,
        company: form.company,
        level: form.level,
      })
      navigate(`/resultats/${result.analysis_id || result.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-forest">Nouvelle analyse</h1>
      <p className="mt-1 text-moss">Assistant en 4 étapes pour comparer votre CV à une offre.</p>

      <ol className="mt-8 flex gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold sm:text-sm ${
              index === step
                ? 'bg-forest text-sand'
                : index < step
                  ? 'bg-mint/60 text-forest'
                  : 'bg-white/50 text-moss'
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-8 min-h-[280px]">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">Choisissez ou importez un CV (PDF, max 5 Mo)</h2>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-moss/40 bg-white/40 px-6 py-10 transition hover:border-coral hover:bg-white/70">
              <span className="font-semibold text-forest">
                {uploading ? 'Import en cours…' : 'Glisser un PDF ou cliquer pour parcourir'}
              </span>
              <span className="mt-1 text-sm text-moss">Uniquement des fichiers PDF</span>
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onUpload} disabled={uploading} />
            </label>
            {loadingCvs ? (
              <p className="text-sm text-moss">Chargement des CV…</p>
            ) : cvs.length === 0 ? (
              <p className="text-sm text-moss">Aucun CV enregistré pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {cvs.map((cv) => (
                  <li key={cv.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCvId(cv.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selectedCvId === cv.id
                          ? 'border-coral bg-coral/5'
                          : 'border-forest/10 bg-white/50 hover:border-moss'
                      }`}
                    >
                      <div className="font-medium text-forest">{cv.original_filename || `CV #${cv.id}`}</div>
                      <div className="text-xs text-moss">
                        {new Date(cv.uploaded_at).toLocaleString('fr-FR')} ·{' '}
                        {(cv.parsed_data?.technical_skills || []).slice(0, 4).join(', ') || 'Compétences en cours'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">Collez le texte de l’offre</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-forest">
                Titre du poste
                <input
                  className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Développeur Python"
                />
              </label>
              <label className="block text-sm font-medium text-forest">
                Entreprise
                <input
                  className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Acme"
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-forest">
              Texte de l’offre
              <textarea
                rows={10}
                className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
                value={form.job_offer_text}
                onChange={(e) => setForm({ ...form, job_offer_text: e.target.value })}
                placeholder="Collez ici la description complète du poste…"
                required
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">Sélectionnez votre niveau</h2>
            <p className="text-sm text-moss">
              Le mode niveau adapte les prompts IA, la pondération du score et le ton de la lettre.
            </p>
            <div className="grid gap-3">
              {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, level: value })}
                  className={`rounded-xl border px-4 py-4 text-left transition ${
                    form.level === value
                      ? 'border-coral bg-coral/5'
                      : 'border-forest/10 bg-white/50 hover:border-moss'
                  }`}
                >
                  <div className="font-semibold text-forest">{label}</div>
                  <div className="mt-1 text-sm text-moss">
                    {value === 'etudiant' && 'Projets académiques, stages, potentiel d’apprentissage.'}
                    {value === 'junior' && 'Réalisations concrètes, outils maîtrisés, travail en équipe.'}
                    {value === 'confirme' && 'Impact, leadership, architecture, résultats mesurables.'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-forest">Récapitulatif</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">CV</dt>
                <dd className="font-medium text-forest">
                  {cvs.find((c) => c.id === selectedCvId)?.original_filename || `#${selectedCvId}`}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">Poste</dt>
                <dd className="font-medium text-forest">{form.title || 'Détecté automatiquement'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">Entreprise</dt>
                <dd className="font-medium text-forest">{form.company || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-forest/10 py-2">
                <dt className="text-moss">Niveau</dt>
                <dd className="font-medium text-forest">{LEVEL_LABELS[form.level]}</dd>
              </div>
            </dl>
            {!import.meta.env.VITE_HAS_LLM && (
              <Alert type="info">
                Mode démonstration : sans clé LLM (`LLM_API_KEY`), l’analyse utilise un moteur déterministe mock.
              </Alert>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <button
          type="button"
          disabled={step === 0 || loading}
          onClick={() => setStep((s) => s - 1)}
          className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest disabled:opacity-40"
        >
          Retour
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
            className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-40"
          >
            Continuer
          </button>
        ) : (
          <button
            type="button"
            disabled={loading || !canNext()}
            onClick={submit}
            className="rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {loading ? 'Analyse en cours…' : 'Lancer l’analyse'}
          </button>
        )}
      </div>
    </div>
  )
}
