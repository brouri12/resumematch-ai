import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/ui'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-forest">Connexion</h1>
      <p className="mt-2 text-sm text-moss">Accédez à ResumeMatch AI</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <Alert>{error}</Alert>}
        <label className="block text-sm font-medium text-forest">
          Nom d’utilisateur
          <input
            className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none ring-moss/30 focus:ring-2"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            autoComplete="username"
          />
        </label>
        <label className="block text-sm font-medium text-forest">
          Mot de passe
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none ring-moss/30 focus:ring-2"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-sand transition hover:bg-moss disabled:opacity-60"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-moss">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="font-semibold text-coral hover:underline">
          S’inscrire
        </Link>
      </p>
    </div>
  )
}
