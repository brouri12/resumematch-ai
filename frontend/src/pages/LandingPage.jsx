import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const features = [
  {
    title: 'Extraction intelligente',
    text: 'Importez votre CV en PDF : compétences, expériences et projets sont structurés automatiquement.',
  },
  {
    title: 'Score de compatibilité',
    text: 'Un score hybride (recouvrement de compétences + évaluation sémantique) avec explication détaillée.',
  },
  {
    title: 'Mode niveau',
    text: 'Étudiant, Junior ou Confirmé : les recommandations et la lettre s’adaptent à votre profil.',
  },
  {
    title: 'Lettre de motivation',
    text: 'Générez, éditez et exportez une lettre personnalisée (formel, dynamique ou concis).',
  },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div>
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(120deg, rgba(15,28,24,0.78) 0%, rgba(26,58,47,0.55) 45%, rgba(196,92,38,0.35) 100%), url("https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1920&q=80")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
          <p
            className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-mint animate-[fadeUp_0.7s_ease-out]"
          >
            CVisionnaires AI
          </p>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.05] text-sand sm:text-6xl md:text-7xl animate-[fadeUp_0.8s_ease-out]">
            ResumeMatch AI
          </h1>
          <p className="mt-5 max-w-xl text-lg text-foam/95 sm:text-xl animate-[fadeUp_0.95s_ease-out]">
            Transformez votre CV, visualisez votre avenir.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-[fadeUp_1.1s_ease-out]">
            <Link
              to={isAuthenticated ? '/analyse' : '/inscription'}
              className="rounded-xl bg-coral px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-coral/30 transition hover:-translate-y-0.5 hover:bg-coral/90"
            >
              Analyser mon CV
            </Link>
            <a
              href="#fonctionnalites"
              className="rounded-xl border border-sand/40 bg-sand/10 px-6 py-3 text-sm font-semibold text-sand backdrop-blur transition hover:bg-sand/20"
            >
              Découvrir
            </a>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl font-bold text-forest sm:text-4xl">
          Une plateforme pensée pour les candidats
        </h2>
        <p className="mt-3 max-w-2xl text-moss">
          Comparez votre CV à une offre, identifiez les écarts et passez à l’action avec des conseils concrets.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="border-l-2 border-moss/40 pl-5 transition hover:border-coral"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <h3 className="font-display text-xl font-semibold text-forest">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-forest/10 bg-forest text-sand">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Prêt à matcher votre prochain poste ?</h2>
            <p className="mt-2 text-mint/90">Projet MVP par l’équipe CVisionnaires AI (6 étudiants).</p>
          </div>
          <Link
            to={isAuthenticated ? '/dashboard' : '/inscription'}
            className="rounded-xl bg-coral px-6 py-3 text-sm font-semibold text-white transition hover:bg-coral/90"
          >
            {isAuthenticated ? 'Mon tableau de bord' : 'Créer un compte'}
          </Link>
        </div>
      </section>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
