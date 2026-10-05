const API_BASE = import.meta.env.VITE_API_URL || ''

const TOKEN_KEY = 'rm_access'
const REFRESH_KEY = 'rm_refresh'

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(TOKEN_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function request(path, { method = 'GET', body, headers = {}, auth = true, isForm = false } = {}) {
  const finalHeaders = { ...headers }
  if (!isForm && body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
  }
  if (auth) {
    const token = getAccessToken()
    if (token) finalHeaders.Authorization = `Bearer ${token}`
  }

  let response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && auth) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      finalHeaders.Authorization = `Bearer ${getAccessToken()}`
      response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: finalHeaders,
        body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
      })
    }
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.blob()

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.error ||
      (typeof data === 'object' ? formatErrors(data) : 'Une erreur est survenue')
    const err = new Error(message)
    err.status = response.status
    err.data = data
    throw err
  }
  return data
}

function formatErrors(data) {
  if (typeof data === 'string') return data
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' · ')
}

async function tryRefresh() {
  const refresh = getRefreshToken()
  if (!refresh) return false
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) {
      clearTokens()
      return false
    }
    const data = await res.json()
    setTokens({ access: data.access })
    return true
  } catch {
    clearTokens()
    return false
  }
}

export const api = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/api/auth/me'),
  updateMe: (payload) => request('/api/auth/me', { method: 'PUT', body: payload }),
  listCvs: () => request('/api/cvs/'),
  uploadCv: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/cvs/', { method: 'POST', body: form, isForm: true })
  },
  deleteCv: (id) => request(`/api/cvs/${id}/`, { method: 'DELETE' }),
  createAnalysis: (payload) => request('/api/analyses/', { method: 'POST', body: payload }),
  listAnalyses: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString()
    return request(`/api/analyses/${qs ? `?${qs}` : ''}`)
  },
  getAnalysis: (id) => request(`/api/analyses/${id}/`),
  deleteAnalysis: (id) => request(`/api/analyses/${id}/`, { method: 'DELETE' }),
  updateStatus: (id, status) =>
    request(`/api/analyses/${id}/status`, { method: 'PATCH', body: { status } }),
  improveCv: (id) => request(`/api/analyses/${id}/improve-cv`, { method: 'POST' }),
  createCoverLetter: (id, tone) =>
    request(`/api/analyses/${id}/cover-letter`, { method: 'POST', body: { tone } }),
  updateCoverLetter: (id, payload) =>
    request(`/api/cover-letters/${id}/`, { method: 'PUT', body: payload }),
  exportCoverLetterUrl: (id, format) =>
    `${API_BASE}/api/cover-letters/${id}/export?format=${format}`,
  dashboardStats: () => request('/api/dashboard/stats/'),
}

export async function downloadCoverLetter(id, format) {
  const token = getAccessToken()
  const res = await fetch(api.exportCoverLetterUrl(id, format), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Export impossible')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lettre_motivation.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
