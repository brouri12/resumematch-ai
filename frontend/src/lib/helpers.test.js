import { describe, expect, it } from 'vitest'
import {
  daysAgo,
  groupByStatus,
  isValidHttpUrl,
  jobOfferText,
  linePath,
  rankJobs,
  scoreChartPoints,
  scoreTone,
  scoreTrend,
  totalLearningWeeks,
} from './helpers'

describe('daysAgo', () => {
  const now = Date.parse('2026-10-05T12:00:00Z')
  it('counts whole days and never goes negative', () => {
    expect(daysAgo('2026-10-05T08:00:00Z', now)).toBe(0)
    expect(daysAgo('2026-10-02T12:00:00Z', now)).toBe(3)
    expect(daysAgo('2026-10-06T12:00:00Z', now)).toBe(0)
  })

  it('returns null for missing or invalid dates', () => {
    expect(daysAgo('', now)).toBeNull()
    expect(daysAgo('nope', now)).toBeNull()
  })
})

describe('scoreTone', () => {
  it('buckets scores at 70 and 45', () => {
    expect([90, 70, 69, 45, 44, 0].map(scoreTone)).toEqual(['high', 'high', 'mid', 'mid', 'low', 'low'])
  })
})

describe('jobOfferText', () => {
  it('prefixes the description with the fields the analyzer parses', () => {
    expect(jobOfferText({ title: 'Dev', company: 'Acme', description: ' React ' })).toBe(
      'Poste: Dev\nEntreprise: Acme\n\nReact',
    )
  })

  it('skips empty fields', () => {
    expect(jobOfferText({ title: 'Dev', description: 'Python' })).toBe('Poste: Dev\n\nPython')
  })
})

describe('groupByStatus', () => {
  it('puts every item in its column and unknown statuses in to_apply', () => {
    const groups = groupByStatus([
      { id: 1, status: 'interview' },
      { id: 2, status: 'offer' },
      { id: 3, status: 'weird' },
    ])
    expect(groups.interview.map((i) => i.id)).toEqual([1])
    expect(groups.offer.map((i) => i.id)).toEqual([2])
    expect(groups.to_apply.map((i) => i.id)).toEqual([3])
    expect(groups.rejected).toEqual([])
  })
})

describe('score chart', () => {
  it('maps 100 to the top and 0 to the bottom of the drawing area', () => {
    const [low, high] = scoreChartPoints([0, 100], { width: 100, height: 100, padding: 10 })
    expect(low).toEqual({ x: 10, y: 90 })
    expect(high).toEqual({ x: 90, y: 10 })
  })

  it('clamps out-of-range scores and centers a single point', () => {
    const [point] = scoreChartPoints([150], { width: 100, height: 100, padding: 10 })
    expect(point).toEqual({ x: 50, y: 10 })
  })

  it('builds an SVG path', () => {
    expect(linePath([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('M1,2 L3,4')
  })

  it('computes the trend between first and last score', () => {
    expect(scoreTrend([40, 55, 72])).toBe(32)
    expect(scoreTrend([60])).toBe(0)
  })
})

describe('rankJobs', () => {
  it('ranks finished jobs by score, unfinished ones last', () => {
    const ranked = rankJobs([
      { id: 1, state: 'running', score: null },
      { id: 2, state: 'done', score: 60 },
      { id: 3, state: 'done', score: 85 },
      { id: 4, state: 'failed', score: null },
    ])
    expect(ranked.map((j) => j.id).slice(0, 2)).toEqual([3, 2])
  })
})

describe('misc', () => {
  it('sums learning weeks', () => {
    expect(totalLearningWeeks([{ estimated_weeks: 1.5 }, { estimated_weeks: 2 }])).toBe(3.5)
    expect(totalLearningWeeks()).toBe(0)
  })

  it('only accepts http(s) URLs', () => {
    expect(isValidHttpUrl('https://example.com/job')).toBe(true)
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isValidHttpUrl('not a url')).toBe(false)
  })
})
