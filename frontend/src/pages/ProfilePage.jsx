import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { motion } from 'motion/react'
import { Alert, LEVEL_LABELS } from '../components/ui'
import { EASE, PageHeader, Stagger, StaggerItem } from '../components/motion'

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
      <motion.div
        className="glass p-8"
        initial={{ opacity: 0, y: 40, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        style={{ transformPerspective: 1000 }}
      >
      <div className="flex items-center gap-4">
        <motion.div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-forest to-leaf font-display text-2xl font-bold text-mint shadow-xl shadow-forest/30"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.2 }}
          whileHover={{ rotate: 8, scale: 1.05 }}
        >
          {(user?.first_name || user?.username || '?').charAt(0).toUpperCase()}
        </motion.div>
        <PageHeader title="Mon profil" subtitle={`Compte ${user?.username || ''}`} />
      </div>

      <Stagger as="form" onSubmit={onSubmit} className="mt-8 space-y-4" delay={0.35}>
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
        <StaggerItem>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            className="btn-shine rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand shadow-lg shadow-forest/25 disabled:opacity-50"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </motion.button>
        </StaggerItem>
      </Stagger>
      </motion.div>
    </div>
  )
}
