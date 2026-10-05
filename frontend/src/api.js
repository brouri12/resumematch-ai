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

function toQuery(params) {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString()
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
  createAnalysisAsync: (payload) => request('/api/analyses/async', { method: 'POST', body: payload }),
  compareOffers: (payload) => request('/api/analyses/compare', { method: 'POST', body: payload }),
  getAnalysisJob: (id) => request(`/api/analysis-jobs/${id}/`),
  getExtra: (id, kind, language) =>
    request(`/api/analyses/${id}/extras/${kind}?language=${language}`),
  generateExtra: (id, kind, language, refresh = false) =>
    request(`/api/analyses/${id}/extras/${kind}`, { method: 'POST', body: { language, refresh } }),
  importJobOffer: (url) => request('/api/job-offers/import-url', { method: 'POST', body: { url } }),
  systemStatus: () => request('/api/system/status/'),
  jobSearch: {
    sources: () => request('/api/job-search/sources'),
    featured: () => request('/api/job-search/featured', { auth: false }),
    list: () => request('/api/job-search/'),
    run: (payload) => request('/api/job-search/', { method: 'POST', body: payload }),
    get: (id) => request(`/api/job-search/${id}/`),
    remove: (id) => request(`/api/job-search/${id}/`, { method: 'DELETE' }),
  },
  admin: {
    overview: () => request('/api/admin-panel/overview/'),
    users: (params = {}) => request(`/api/admin-panel/users/?${toQuery(params)}`),
    updateUser: (id, payload) => request(`/api/admin-panel/users/${id}/`, { method: 'PATCH', body: payload }),
    deleteUser: (id) => request(`/api/admin-panel/users/${id}/`, { method: 'DELETE' }),
    analyses: (params = {}) => request(`/api/admin-panel/analyses/?${toQuery(params)}`),
    deleteAnalysis: (id) => request(`/api/admin-panel/analyses/${id}/`, { method: 'DELETE' }),
    jobs: (params = {}) => request(`/api/admin-panel/jobs/?${toQuery(params)}`),
    purgeJobs: () => request('/api/admin-panel/jobs/', { method: 'DELETE' }),
    clearCache: () => request('/api/admin-panel/cache/', { method: 'DELETE' }),
    settings: () => request('/api/admin-panel/settings/'),
    updateSettings: (payload) => request('/api/admin-panel/settings/', { method: 'PUT', body: payload }),
  },
  listAnalyses: (params = {}) => {
    const qs = toQuery(params)
    return request(`/api/analyses/${qs ? `?${qs}` : ''}`)
  },
  getAnalysis: (id) => request(`/api/analyses/${id}/`),
  deleteAnalysis: (id) => request(`/api/analyses/${id}/`, { method: 'DELETE' }),
  updateStatus: (id, status) =>
    request(`/api/analyses/${id}/status`, { method: 'PATCH', body: { status } }),
  improveCv: (id, language = 'fr') =>
    request(`/api/analyses/${id}/improve-cv`, { method: 'POST', body: { language } }),
  createCoverLetter: (id, tone, language = 'fr') =>
    request(`/api/analyses/${id}/cover-letter`, { method: 'POST', body: { tone, language } }),
  updateCoverLetter: (id, payload) =>
    request(`/api/cover-letters/${id}/`, { method: 'PUT', body: payload }),
  exportCoverLetterUrl: (id, format) =>
    `${API_BASE}/api/cover-letters/${id}/export?format=${format}`,
  dashboardStats: () => request('/api/dashboard/stats/'),
}

async function downloadFile(path, filename) {
  const blob = await request(path)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCoverLetter(id, format) {
  return downloadFile(`/api/cover-letters/${id}/export?format=${format}`, `lettre_motivation.${format}`)
}

export function downloadReport(id, language = 'fr') {
  return downloadFile(`/api/analyses/${id}/report?language=${language}`, `rapport_analyse_${id}.docx`)
}

export async function pollJob(jobId, onUpdate, { interval = 1200, timeout = 300000 } = {}) {
  const started = Date.now()
  for (;;) {
    const job = await api.getAnalysisJob(jobId)
    onUpdate?.(job)
    if (job.state === 'done' || job.state === 'failed') return job
    if (Date.now() - started > timeout) throw new Error('Analysis timeout')
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}
