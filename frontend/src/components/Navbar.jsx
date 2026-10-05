import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { LANGUAGES } from '../lib/translations'
import { EASE } from './motion'

function LanguageToggle() {
  const { lang, setLang } = useI18n()
  return (
    <div className="flex rounded-lg border border-forest/15 bg-white/50 p-0.5 text-xs font-semibold" role="group" aria-label="Language">
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`rounded-md px-2 py-1 uppercase transition-colors ${
            lang === code ? 'bg-forest text-sand' : 'text-forest/70 hover:text-forest'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  )
}

const linkClass = ({ isActive }) =>
  `relative px-1 py-1 text-sm font-medium transition-colors ${isActive ? 'text-coral' : 'text-forest/80 hover:text-forest'}`

function AnimatedNavLink({ to, children }) {
  return (
    <NavLink to={to} className={linkClass}>
      {({ isActive }) => (
        <>
          {children}
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-coral to-leaf"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth()
  const { t } = useI18n()
  const { scrollY } = useScroll()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 12))

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const appLinks = [
    ['/dashboard', 'nav.dashboard'],
    ['/analyse', 'nav.analyze'],
    ['/offres', 'nav.jobs'],
    ['/comparer', 'nav.compare'],
    ['/candidatures', 'nav.board'],
    ['/historique', 'nav.history'],
    ['/profil', 'nav.profile'],
    ...(user?.is_staff ? [['/administration', 'nav.admin']] : []),
  ]

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={`sticky top-0 z-40 border-b transition-all duration-500 ${
        scrolled
          ? 'border-forest/10 bg-sand/75 shadow-[0_10px_40px_-20px_rgba(20,53,43,0.4)] backdrop-blur-xl'
          : 'border-transparent bg-sand/40 backdrop-blur-md'
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition-all duration-500 sm:px-6 ${
          scrolled ? 'py-2' : 'py-3'
        }`}
      >
        <Link to="/" className="group flex items-center gap-2">
          <motion.span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint shadow-lg shadow-forest/20"
            whileHover={{ rotate: -8, scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            RM
          </motion.span>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold text-forest">ResumeMatch AI</div>
            <div className="text-[11px] tracking-wide text-moss/80">CVisionnaires AI</div>
          </div>
        </Link>

        <nav className={`hidden items-center gap-4 whitespace-nowrap ${isAuthenticated ? 'xl:flex' : 'md:flex'}`}>
          {isAuthenticated ? (
            appLinks.map(([to, key]) => (
              <AnimatedNavLink key={to} to={to}>
                {t(key)}
              </AnimatedNavLink>
            ))
          ) : (
            <a href="/#fonctionnalites" className="text-sm font-medium text-forest/80 transition-colors hover:text-forest">
              {t('nav.features')}
            </a>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          {isAuthenticated ? (
            <>
              <span className="hidden text-sm text-moss 2xl:inline">{user?.first_name || user?.username}</span>
              <motion.button
                type="button"
                onClick={logout}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
                className="hidden rounded-lg border border-forest/20 px-3 py-1.5 text-sm font-medium text-forest transition-colors hover:bg-forest hover:text-sand sm:block"
              >
                {t('nav.logout')}
              </motion.button>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="Menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-forest/20 text-forest xl:hidden"
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/connexion"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-forest transition-colors hover:bg-forest/5"
              >
                {t('nav.login')}
              </Link>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to="/inscription"
                  className="btn-shine block rounded-lg bg-coral px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-coral/30 transition-colors hover:bg-coral/90"
                >
                  {t('nav.start')}
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </div>
      <AnimatePresence>
        {isAuthenticated && menuOpen && (
          <motion.nav
            className="overflow-hidden border-t border-forest/10 xl:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className="mx-auto grid max-w-7xl gap-1 px-4 py-3 sm:grid-cols-3 sm:px-6">
              {appLinks.map(([to, key]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-forest text-sand' : 'text-forest hover:bg-white/60'}`
                  }
                >
                  {t(key)}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-coral hover:bg-white/60 sm:hidden"
              >
                {t('nav.logout')}
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
