import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useI18n } from '../context/I18nContext'
import { linePath, scoreChartPoints, scoreTrend } from '../lib/helpers'
import { EASE } from './motion'

const WIDTH = 640
const HEIGHT = 220

export default function ScoreTimeline({ timeline = [] }) {
  const { t, locale } = useI18n()
  const [hover, setHover] = useState(null)

  if (timeline.length < 2) {
    return <p className="text-sm text-moss">{t('dash.evolutionEmpty')}</p>
  }

  const scores = timeline.map((p) => p.score)
  const points = scoreChartPoints(scores, { width: WIDTH, height: HEIGHT, padding: 24 })
  const path = linePath(points)
  const area = `${path} L${points[points.length - 1].x},${HEIGHT - 24} L${points[0].x},${HEIGHT - 24} Z`
  const trend = scoreTrend(scores)
  const active = hover !== null ? timeline[hover] : null

  return (
    <div>
      <p className={`text-sm font-semibold ${trend >= 0 ? 'text-leaf' : 'text-coral'}`}>
        {trend >= 0 ? t('dash.trendUp', { n: trend }) : t('dash.trendDown', { n: trend })}
      </p>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={t('dash.evolution')}>
          <defs>
            <linearGradient id="score-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3a8f6e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3a8f6e" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 75, 100].map((v) => {
            const y = 24 + (HEIGHT - 48) * (1 - v / 100)
            return (
              <g key={v}>
                <line x1="24" x2={WIDTH - 24} y1={y} y2={y} stroke="#14352b" strokeOpacity="0.08" strokeDasharray="4 6" />
                <text x="4" y={y + 4} fontSize="10" fill="#2a6b54">
                  {v}
                </text>
              </g>
            )
          })}
          <motion.path d={area} fill="url(#score-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }} />
          <motion.path
            d={path}
            fill="none"
            stroke="#0e7c66"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: EASE }}
          />
          {points.map((p, i) => (
            <g key={timeline[i].id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
              <circle cx={p.x} cy={p.y} r={hover === i ? 6 : 4} fill="#fff" stroke="#0e7c66" strokeWidth="2.5" />
            </g>
          ))}
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-forest px-3 py-2 text-xs text-sand shadow-lg"
            style={{ left: `${(points[hover].x / WIDTH) * 100}%`, top: `${(points[hover].y / HEIGHT) * 100}%`, marginTop: -10 }}
          >
            <div className="font-semibold">{active.score}/100</div>
            <div className="max-w-[180px] truncate">{active.job_title}</div>
            <div className="text-mint">{new Date(active.date).toLocaleDateString(locale)}</div>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {timeline.slice(-5).map((p) => (
          <Link key={p.id} to={`/resultats/${p.id}`} className="rounded-md bg-white/60 px-2 py-1 text-forest hover:text-coral">
            {p.job_title} · {p.score}
          </Link>
        ))}
      </div>
    </div>
  )
}
