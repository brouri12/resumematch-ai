import { useState } from 'react'
import { api } from '../api'
import { useI18n } from '../context/I18nContext'
import { isValidHttpUrl } from '../lib/helpers'

export default function OfferUrlImport({ onImported }) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const onImport = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const result = await api.importJobOffer(url.trim())
      onImported(result)
      setMessage({ type: 'success', text: t('wiz.urlDone') })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-forest">
        {t('wiz.urlLabel')}
        <div className="mt-1 flex gap-2">
          <input
            type="url"
            className="w-full rounded-xl border border-forest/15 bg-white/70 px-3 py-2.5 outline-none focus:ring-2 focus:ring-moss/30"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValidHttpUrl(url.trim())) {
                e.preventDefault()
                onImport()
              }
            }}
            placeholder="https://…"
          />
          <button
            type="button"
            onClick={onImport}
            disabled={loading || !isValidHttpUrl(url.trim())}
            className="shrink-0 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-sand disabled:opacity-40"
          >
            {loading ? t('wiz.urlImporting') : t('wiz.urlImport')}
          </button>
        </div>
      </label>
      {message && (
        <p className={`mt-1 text-xs ${message.type === 'error' ? 'text-coral' : 'text-leaf'}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  )
}
