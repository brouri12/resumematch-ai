import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { Alert, LEVEL_LABELS } from '../components/ui'
import { EASE, PageHeader, Stagger, StaggerItem } from '../components/motion'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    level: 'junior',
    target_job_title: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Inscription impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <motion.div
        className="glass p-8"
        initial={{ opacity: 0, y: 40, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        style={{ transformPerspective: 1000 }}
      >
        <PageHeader
          eyebrow="Bienvenue"
          title="Créer un compte"
          subtitle="Rejoignez ResumeMatch AI en quelques secondes."
        />
        <Stagger as="form" onSubmit={onSubmit} className="mt-8 grid gap-4 sm:grid-cols-2" delay={0.35} gap={0.06}>
          {error && (
            <div className="sm:col-span-2">
              <Alert>{error}</Alert>
            </div>
          )}
          {[
            ['username', 'Nom d’utilisateur', 'text'],
            ['email', 'E-mail', 'email'],
            ['first_name', 'Prénom', 'text'],
            ['last_name', 'Nom', 'text'],
            ['password', 'Mot de passe', 'password'],
            ['password_confirm', 'Confirmer le mot de passe', 'password'],
          ].map(([name, label, type]) => (
            <StaggerItem as="label" key={name} className="block text-sm font-medium text-forest">
              {label}
              <input
                name={name}
                type={type}
                className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none ring-moss/30 focus:ring-2"
                value={form[name]}
                onChange={onChange}
                required={['username', 'email', 'password', 'password_confirm'].includes(name)}
              />
            </StaggerItem>
          ))}
          <StaggerItem as="label" className="block text-sm font-medium text-forest">
            Niveau
            <select
              name="level"
              className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none ring-moss/30 focus:ring-2"
              value={form.level}
              onChange={onChange}
            >
              {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </StaggerItem>
          <StaggerItem as="label" className="block text-sm font-medium text-forest">
            Poste cible
            <input
              name="target_job_title"
              className="mt-1 w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none ring-moss/30 focus:ring-2"
              value={form.target_job_title}
              onChange={onChange}
              placeholder="ex. Développeur backend"
            />
          </StaggerItem>
          <StaggerItem className="sm:col-span-2">
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="btn-shine w-full rounded-xl bg-coral py-3 text-sm font-semibold text-white shadow-lg shadow-coral/30 transition-colors hover:bg-coral/90 disabled:opacity-60"
            >
              {loading ? 'Création…' : 'Créer mon compte'}
            </motion.button>
          </StaggerItem>
        </Stagger>
        <motion.p
          className="mt-6 text-center text-sm text-moss"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Déjà inscrit ?{' '}
          <Link to="/connexion" className="font-semibold text-coral hover:underline">
            Se connecter
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
