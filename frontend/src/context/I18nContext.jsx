import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANG_STORAGE_KEY, detectLanguage, translate } from '../lib/i18n'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() =>
    detectLanguage(localStorage.getItem(LANG_STORAGE_KEY), navigator.language),
  )

  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const value = useMemo(() => ({ lang, setLang, t, locale }), [lang, t, locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
