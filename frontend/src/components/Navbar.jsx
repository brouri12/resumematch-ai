import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const linkClass = ({ isActive }) =>
  `text-sm font-medium transition-colors ${isActive ? 'text-coral' : 'text-forest/80 hover:text-forest'}`

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-forest/10 bg-sand/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint transition-transform group-hover:scale-105">
            RM
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold text-forest">ResumeMatch AI</div>
            <div className="text-[11px] tracking-wide text-moss/80">CVisionnaires AI</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" className={linkClass}>Tableau de bord</NavLink>
              <NavLink to="/analyse" className={linkClass}>Nouvelle analyse</NavLink>
              <NavLink to="/historique" className={linkClass}>Historique</NavLink>
              <NavLink to="/profil" className={linkClass}>Profil</NavLink>
            </>
          ) : (
            <>
              <a href="/#fonctionnalites" className="text-sm font-medium text-forest/80 hover:text-forest">
                Fonctionnalités
              </a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="hidden text-sm text-moss sm:inline">{user?.first_name || user?.username}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-forest/20 px-3 py-1.5 text-sm font-medium text-forest transition hover:bg-forest hover:text-sand"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                to="/connexion"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-forest hover:bg-forest/5"
              >
                Connexion
              </Link>
              <Link
                to="/inscription"
                className="rounded-lg bg-coral px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-coral/90"
              >
                Commencer
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
