import { LANGUAGES, translations } from './translations'

export const LANG_STORAGE_KEY = 'rm_lang'

export function detectLanguage(stored, browser) {
  if (LANGUAGES.includes(stored)) return stored
  const short = (browser || '').slice(0, 2).toLowerCase()
  return LANGUAGES.includes(short) ? short : 'fr'
}

export function translate(lang, key, vars) {
  const template = translations[lang]?.[key] ?? translations.fr[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
}
