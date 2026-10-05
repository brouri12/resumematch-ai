import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Alert, LEVEL_LABELS } from '../components/ui'

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    level: 'junior',
    target_job_title: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        level: user.level || 'junior',
        target_job_title: user.target_job_title || '',
      })
    }
  }, [user])

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await updateProfile(form)
      setMessage('Profil mis à jour.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-forest">Mon profil</h1>
      <p className="mt-1 text-sm text-moss">
        Compte <strong>{user?.username}</strong>
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <Alert>{error}</Alert>}
        {message && <Alert type="success">{message}</Alert>}
        <label className="block text-sm font-medium text-forest">
          E-mail
          <input
            type="email"
            className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-forest">
            Prénom
            <input
              className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium text-forest">
            Nom
            <input
              className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-forest">
          Niveau
          <select
            className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          >
            {Object.entries(LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-forest">
          Poste cible
          <input
            className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
            value={form.target_job_title}
            onChange={(e) => setForm({ ...form, target_job_title: e.target.value })}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-50"
        >
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
