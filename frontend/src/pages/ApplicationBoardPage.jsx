import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { api } from '../api'
import { Alert } from '../components/ui'
import { Loader, PageHeader } from '../components/motion'
import { useI18n } from '../context/I18nContext'
import { STATUS_ORDER, groupByStatus } from '../lib/helpers'

const COLUMN_ACCENTS = {
  to_apply: 'from-amber/60',
  applied: 'from-moss/50',
  interview: 'from-leaf/60',
  offer: 'from-mint',
  rejected: 'from-forest/30',
}

export default function ApplicationBoardPage() {
  const { t } = useI18n()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .listAnalyses({ page_size: 100 })
      .then((res) => !cancelled && setItems(res.results || []))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => groupByStatus(items), [items])

  const move = async (id, status) => {
    const previous = items
    const current = items.find((i) => i.id === id)
    if (!current || current.status === status) return
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status } : i)))
    try {
      await api.updateStatus(id, status)
    } catch (err) {
      setItems(previous)
      setError(err.message)
    }
  }

  const onDrop = (e, status) => {
    e.preventDefault()
    setDragOver(null)
    const id = Number(e.dataTransfer.getData('text/plain'))
    if (id) move(id, status)
  }

  if (loading) return <Loader label={t('common.loading')} />

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t('board.eyebrow')} title={t('board.title')} subtitle={t('board.subtitle')} />
      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-8 flex gap-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(status)
            }}
            onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
            onDrop={(e) => onDrop(e, status)}
            className={`flex min-h-[320px] w-[240px] shrink-0 flex-col rounded-2xl border bg-white/40 p-3 backdrop-blur transition-colors xl:w-auto xl:flex-1 ${
              dragOver === status ? 'border-coral bg-coral/5' : 'border-white/60'
            }`}
          >
            <div className={`mb-3 rounded-xl bg-gradient-to-r ${COLUMN_ACCENTS[status]} to-transparent px-3 py-2`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-forest">{t(`status.${status}`)}</h2>
                <span className="rounded-full bg-white/70 px-2 text-xs font-semibold text-forest">
                  {groups[status].length}
                </span>
              </div>
            </div>
            <ul className="flex flex-1 flex-col gap-2">
              {groups[status].length === 0 && (
                <li className="rounded-xl border border-dashed border-forest/15 px-3 py-6 text-center text-xs text-moss/70">
                  {t('board.empty')}
                </li>
              )}
              {groups[status].map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  layoutId={`card-${item.id}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(item.id))}
                  className="cursor-grab rounded-xl border border-forest/10 bg-white/80 p-3 shadow-sm active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/resultats/${item.id}`} className="text-sm font-semibold text-forest hover:text-coral">
                      {item.job_title}
                    </Link>
                    <span className="font-display text-lg font-bold text-forest">{item.score}</span>
                  </div>
                  <p className="text-xs text-moss">{item.company || t('common.companyUnknown')}</p>
                  <select
                    aria-label={t('board.moveTo')}
                    className="mt-2 w-full rounded-lg border border-forest/10 bg-white/70 px-2 py-1 text-xs"
                    value={item.status}
                    onChange={(e) => move(item.id, e.target.value)}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {t(`status.${s}`)}
                      </option>
                    ))}
                  </select>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
