import { describe, expect, it } from 'vitest'
import { detectLanguage, translate } from './i18n'
import { translations } from './translations'

describe('translate', () => {
  it('returns the string for the requested language', () => {
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard')
    expect(translate('fr', 'nav.dashboard')).toBe('Tableau de bord')
  })

  it('interpolates variables and leaves unknown placeholders intact', () => {
    expect(translate('en', 'cmp.offer', { n: 3 })).toBe('Offer 3')
    expect(translate('en', 'cmp.offer')).toBe('Offer {n}')
  })

  it('falls back to French, then to the key itself', () => {
    expect(translate('de', 'nav.history')).toBe('Historique')
    expect(translate('en', 'missing.key')).toBe('missing.key')
  })
})

describe('detectLanguage', () => {
  it('prefers a valid stored value, then the browser language, then French', () => {
    expect(detectLanguage('en', 'fr-FR')).toBe('en')
    expect(detectLanguage(null, 'en-US')).toBe('en')
    expect(detectLanguage('xx', 'es-ES')).toBe('fr')
  })
})

describe('translations', () => {
  it('has the same keys in every language', () => {
    const fr = Object.keys(translations.fr).sort()
    const en = Object.keys(translations.en).sort()
    expect(en).toEqual(fr)
  })

  it('keeps the same placeholders across languages', () => {
    const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort()
    for (const key of Object.keys(translations.fr)) {
      expect(placeholders(translations.en[key]), key).toEqual(placeholders(translations.fr[key]))
    }
  })
})
