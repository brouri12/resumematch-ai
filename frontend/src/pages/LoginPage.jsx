import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion } from 'motion/react'
import { Alert } from '../components/ui'
import { EASE, PageHeader, Stagger, StaggerItem } from '../components/motion'

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
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-12">
      <motion.div
        className="glass p-8"
        initial={{ opacity: 0, y: 40, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        style={{ transformPerspective: 1000 }}
      >
      <PageHeader eyebrow="Bon retour" title="Connexion" subtitle="Accédez à ResumeMatch AI" />
      <Stagger as="form" onSubmit={onSubmit} className="mt-8 space-y-4" delay={0.35}>
        {error && <Alert>{error}</Alert>}
        <StaggerItem as="label" className="block text-sm font-medium text-forest">
          Nom d’utilisateur
          <input
            className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none ring-moss/30 focus:ring-2"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            autoComplete="username"
          />
        </StaggerItem>
        <StaggerItem as="label" className="block text-sm font-medium text-forest">
          Mot de passe
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none ring-moss/30 focus:ring-2"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            autoComplete="current-password"
          />
        </StaggerItem>
        <StaggerItem>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="btn-shine w-full rounded-xl bg-forest py-3 text-sm font-semibold text-sand shadow-lg shadow-forest/25 transition-colors hover:bg-moss disabled:opacity-60"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </motion.button>
        </StaggerItem>
      </Stagger>
      <motion.p
        className="mt-6 text-center text-sm text-moss"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="font-semibold text-coral hover:underline">
          S’inscrire
        </Link>
      </motion.p>
      </motion.div>
    </div>
  )
}
