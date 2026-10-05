import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'motion/react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { daysAgo, isValidHttpUrl } from '../lib/helpers'
import { contractLabel, sourceInfo } from '../lib/sources'
import {
  EASE,
  Magnetic,
  Reveal,
  SplitText,
  Stagger,
  StaggerItem,
  TiltCard,
} from '../components/motion'

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

const steps = [
  { title: 'Importez', text: 'Déposez votre CV au format PDF.' },
  { title: 'Collez l’offre', text: 'Ajoutez la description du poste visé.' },
  { title: 'Analysez', text: 'Obtenez score, écarts et recommandations.' },
  { title: 'Postulez', text: 'Générez une lettre sur mesure et suivez vos candidatures.' },
]

function Hero({ isAuthenticated }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '40%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <section ref={ref} className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-ink">
      <motion.div className="absolute inset-0" style={{ y: bgY }} aria-hidden>
        <motion.div
          className="absolute inset-[-6%]"
          initial={{ scale: 1.25, opacity: 0 }}
          animate={{ scale: [1.25, 1.08, 1.14], opacity: 1 }}
          transition={{
            scale: { duration: 22, ease: 'easeOut', times: [0, 0.4, 1] },
            opacity: { duration: 1.8, ease: 'easeOut' },
          }}
          style={{
            backgroundImage:
              'linear-gradient(120deg, rgba(12,24,20,0.86) 0%, rgba(20,53,43,0.62) 48%, rgba(14,124,102,0.38) 100%), url("https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1920&q=80")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5,12,10,0.75) 100%)' }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-[10%] top-1/3 h-72 w-72 rounded-full bg-mint/25 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, -30, 0], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-10 right-[8%] h-80 w-80 rounded-full bg-amber/20 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, 40, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 z-20 bg-black"
        initial={{ height: '50%' }}
        animate={{ height: '0%' }}
        transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-20 bg-black"
        initial={{ height: '50%' }}
        animate={{ height: '0%' }}
        transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        <motion.div
          className="mb-4 flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 1.1, ease: EASE }}
        >
          <motion.span
            className="h-px bg-mint"
            initial={{ width: 0 }}
            animate={{ width: 48 }}
            transition={{ duration: 1, delay: 1.2, ease: EASE }}
          />
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-mint">CVisionnaires AI</span>
        </motion.div>

        <h1 className="max-w-4xl font-display text-5xl font-bold leading-[1.02] text-sand sm:text-6xl md:text-8xl">
          <SplitText text="ResumeMatch" delay={1.25} />
          <br />
          <span className="sr-only"> AI</span>
          <span className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
            <motion.span
              className="text-shimmer inline-block"
              initial={{ y: '110%', opacity: 0, rotate: 4 }}
              animate={{ y: '0%', opacity: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 1.45, ease: EASE }}
            >
              AI
            </motion.span>
          </span>
        </h1>

        <motion.p
          className="mt-6 max-w-xl text-lg text-foam/95 sm:text-xl"
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, delay: 1.8, ease: EASE }}
        >
          Transformez votre CV, visualisez votre avenir.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 2.05, ease: EASE }}
        >
          <Magnetic>
            <Link
              to={isAuthenticated ? '/analyse' : '/inscription'}
              className="btn-shine block rounded-xl bg-coral px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-coral/40 transition-colors hover:bg-coral/90"
            >
              Analyser mon CV →
            </Link>
          </Magnetic>
          <Magnetic>
            <a
              href="#fonctionnalites"
              className="block rounded-xl border border-sand/40 bg-sand/10 px-7 py-3.5 text-sm font-semibold text-sand backdrop-blur transition-colors hover:bg-sand/20"
            >
              Découvrir
            </a>
          </Magnetic>
        </motion.div>
      </motion.div>

      <motion.a
        href="#fonctionnalites"
        aria-label="Faire défiler"
        className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-mint/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6, duration: 1 }}
      >
        Défiler
        <span className="flex h-9 w-5 justify-center rounded-full border border-mint/50 pt-1.5">
          <motion.span
            className="h-2 w-1 rounded-full bg-mint"
            animate={{ y: [0, 12, 0], opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </motion.a>
    </section>
  )
}

function Steps() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] })
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section ref={ref} className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-leaf">Comment ça marche</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-forest sm:text-4xl">Quatre étapes, un résultat</h2>
      </Reveal>
      <div className="relative mt-14">
        <div className="absolute left-0 right-0 top-5 hidden h-[2px] bg-forest/10 md:block" />
        <motion.div
          className="absolute left-0 right-0 top-5 hidden h-[2px] origin-left bg-gradient-to-r from-coral via-leaf to-mint md:block"
          style={{ scaleX: lineScale }}
        />
        <Stagger inView gap={0.15} className="grid gap-10 md:grid-cols-4">
          {steps.map((step, i) => (
            <StaggerItem key={step.title} className="relative">
              <motion.div
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-forest font-display text-sm font-bold text-mint shadow-lg shadow-forest/30"
                whileHover={{ scale: 1.15, rotate: 10 }}
              >
                {i + 1}
              </motion.div>
              <h3 className="mt-5 font-display text-xl font-semibold text-forest">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">{step.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

function SourceLogos({ sources, total }) {
  const active = sources.filter((s) => s.count > 0)
  if (!active.length) return null
  return (
    <section className="border-b border-forest/10 bg-white/40 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-leaf">
            {total} offres réelles agrégées depuis
          </p>
        </Reveal>
        <Stagger inView gap={0.08} className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {active.map((s) => {
            const info = sourceInfo(s.id)
            return (
              <StaggerItem key={s.id}>
                <motion.a
                  href={info.url || s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-2xl border border-forest/10 bg-white/70 px-4 py-3 shadow-sm"
                  whileHover={{ y: -4, boxShadow: '0 12px 30px -12px rgba(20,53,43,0.35)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <img
                    src={info.logo}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-10 w-10 rounded-xl object-contain transition duration-300 group-hover:scale-110"
                  />
                  <span className="text-left">
                    <span className="block font-display text-base font-semibold text-forest">{info.label}</span>
                    <span className="block text-xs text-moss">{s.count} offres</span>
                  </span>
                </motion.a>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}

function postedLabel(iso) {
  const days = daysAgo(iso)
  if (days === null) return ''
  if (days === 0) return 'Aujourd’hui'
  if (days === 1) return 'Hier'
  return `Il y a ${days} j`
}

function FeaturedOffers({ offers, loading, isAuthenticated }) {
  if (!loading && !offers.length) return null
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-leaf">Offres du moment</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-forest sm:text-4xl">
          Des offres réelles, mises à jour en continu
        </h2>
        <p className="mt-3 max-w-2xl text-moss">
          Un aperçu des dernières offres tech. Connectez-vous pour que l’IA les classe selon votre CV.
        </p>
      </Reveal>

      {loading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="glass h-44 animate-pulse p-5">
              <div className="h-4 w-24 rounded bg-forest/10" />
              <div className="mt-4 h-5 w-3/4 rounded bg-forest/10" />
              <div className="mt-2 h-4 w-1/2 rounded bg-forest/10" />
            </div>
          ))}
        </div>
      ) : (
        <Stagger inView gap={0.07} className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            const info = sourceInfo(offer.source)
            const card = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-moss">
                    {info.logo && <img src={info.logo} alt="" width={20} height={20} className="h-5 w-5 rounded object-contain" />}
                    {info.label}
                  </span>
                  <span className="text-[11px] text-moss">{postedLabel(offer.published_at)}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 font-display text-lg font-semibold leading-snug text-forest">
                  {offer.title}
                </h3>
                <p className="mt-1 truncate text-sm text-moss">
                  {[offer.company, offer.location].filter(Boolean).join(' · ')}
                </p>
                {offer.excerpt && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-moss/90">{offer.excerpt}</p>}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-4 text-[11px] font-medium">
                  {offer.remote && <span className="rounded-md bg-mint/60 px-2 py-0.5 text-forest">Télétravail</span>}
                  {offer.contract && <span className="rounded-md bg-white/70 px-2 py-0.5 text-moss">{contractLabel(offer.contract)}</span>}
                  <span className="ml-auto text-coral transition-transform group-hover:translate-x-1">Voir l’offre ↗</span>
                </div>
              </>
            )
            return (
              <StaggerItem key={offer.id}>
                {isValidHttpUrl(offer.url) ? (
                  <motion.a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass group flex h-full flex-col p-5"
                    whileHover={{ y: -6 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  >
                    {card}
                  </motion.a>
                ) : (
                  <div className="glass flex h-full flex-col p-5">{card}</div>
                )}
              </StaggerItem>
            )
          })}
        </Stagger>
      )}

      <Reveal className="mt-10 flex justify-center">
        <Magnetic>
          <Link
            to={isAuthenticated ? '/offres' : '/inscription'}
            className="btn-shine block rounded-xl bg-forest px-7 py-3.5 text-sm font-semibold text-sand shadow-xl shadow-forest/25 transition-colors hover:bg-forest/90"
          >
            Trouver les offres faites pour mon CV →
          </Link>
        </Magnetic>
      </Reveal>
    </section>
  )
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const [featured, setFeatured] = useState({ offers: [], sources: [], total: 0 })
  const [loadingOffers, setLoadingOffers] = useState(true)

  useEffect(() => {
    api.jobSearch
      .featured()
      .then(setFeatured)
      .catch(() => {})
      .finally(() => setLoadingOffers(false))
  }, [])

  return (
    <div>
      <Hero isAuthenticated={isAuthenticated} />
      <SourceLogos sources={featured.sources} total={featured.total} />

      <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-leaf">Fonctionnalités</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-forest sm:text-5xl">
            Une plateforme pensée pour les candidats
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-2xl text-moss">
            Comparez votre CV à une offre, identifiez les écarts et passez à l’action avec des conseils concrets.
          </p>
        </Reveal>
        <Stagger inView gap={0.12} className="mt-14 grid gap-6 sm:grid-cols-2">
          {features.map((feature, index) => (
            <StaggerItem key={feature.title}>
              <TiltCard className="glass h-full p-7">
                <div className="relative [transform:translateZ(30px)]">
                  <span className="font-display text-5xl font-bold text-mint/80">0{index + 1}</span>
                  <h3 className="mt-3 font-display text-xl font-semibold text-forest">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-moss">{feature.text}</p>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <Steps />

      <FeaturedOffers offers={featured.offers} loading={loadingOffers} isAuthenticated={isAuthenticated} />

      <section className="relative overflow-hidden border-t border-forest/10 bg-forest text-sand">
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(600px circle at 20% 50%, rgba(58,143,110,0.6), transparent 60%), radial-gradient(500px circle at 80% 50%, rgba(212,160,23,0.25), transparent 60%)',
            backgroundSize: '200% 200%',
          }}
          animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
        <Reveal className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-4xl">Prêt à matcher votre prochain poste ?</h2>
            <p className="mt-2 text-mint/90">Projet MVP par l’équipe CVisionnaires AI (6 étudiants).</p>
          </div>
          <Magnetic>
            <Link
              to={isAuthenticated ? '/dashboard' : '/inscription'}
              className="btn-shine block rounded-xl bg-coral px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-black/30 transition-colors hover:bg-coral/90"
            >
              {isAuthenticated ? 'Mon tableau de bord' : 'Créer un compte'}
            </Link>
          </Magnetic>
        </Reveal>
      </section>
    </div>
  )
}
