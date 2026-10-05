export const STATUS_ORDER = ['to_apply', 'applied', 'interview', 'offer', 'rejected']

export function groupByStatus(items) {
  const groups = Object.fromEntries(STATUS_ORDER.map((s) => [s, []]))
  for (const item of items) {
    const key = STATUS_ORDER.includes(item.status) ? item.status : 'to_apply'
    groups[key].push(item)
  }
  return groups
}

export function scoreChartPoints(scores, { width, height, padding = 16 }) {
  if (!scores.length) return []
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  const step = scores.length > 1 ? innerW / (scores.length - 1) : 0
  return scores.map((score, i) => {
    const clamped = Math.max(0, Math.min(100, Number(score) || 0))
    return {
      x: Math.round((padding + (scores.length > 1 ? i * step : innerW / 2)) * 10) / 10,
      y: Math.round((padding + innerH * (1 - clamped / 100)) * 10) / 10,
    }
  })
}

export function linePath(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
}

export function scoreTrend(scores) {
  if (scores.length < 2) return 0
  return Math.round(scores[scores.length - 1] - scores[0])
}

export function rankJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const aDone = a.state === 'done' ? 1 : 0
    const bDone = b.state === 'done' ? 1 : 0
    if (aDone !== bDone) return bDone - aDone
    return (b.score ?? -1) - (a.score ?? -1)
  })
}

export function totalLearningWeeks(steps = []) {
  return Math.round(steps.reduce((sum, s) => sum + (Number(s.estimated_weeks) || 0), 0) * 10) / 10
}

export function scoreTone(score) {
  if (score >= 70) return 'high'
  if (score >= 45) return 'mid'
  return 'low'
}

export function jobOfferText({ title = '', company = '', location = '', description = '' }) {
  const header = [
    title && `Poste: ${title}`,
    company && `Entreprise: ${company}`,
    location && `Lieu: ${location}`,
  ].filter(Boolean)
  return [...header, '', description.trim()].join('\n').trim()
}

export function daysAgo(iso, now = Date.now()) {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  return Math.max(0, Math.floor((now - time) / 86400000))
}

export function isValidHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
