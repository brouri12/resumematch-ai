export const JOB_SOURCES = {
  france_travail: { label: 'France Travail', logo: '/logos/france_travail.png', url: 'https://candidat.francetravail.fr' },
  adzuna: { label: 'Adzuna', logo: '/logos/adzuna.png', url: 'https://www.adzuna.fr' },
  remotive: { label: 'Remotive', logo: '/logos/remotive.png', url: 'https://remotive.com' },
  jobicy: { label: 'Jobicy', logo: '/logos/jobicy.png', url: 'https://jobicy.com' },
  arbeitnow: { label: 'Arbeitnow', logo: '/logos/arbeitnow.svg', url: 'https://www.arbeitnow.com' },
}

const CONTRACT_LABELS = {
  permanent: 'CDI',
  contract: 'CDD',
  full_time: 'Temps plein',
  'full-time': 'Temps plein',
  part_time: 'Temps partiel',
  'part-time': 'Temps partiel',
  freelance: 'Freelance',
  internship: 'Stage',
}

export function contractLabel(value = '') {
  const first = value.split(',')[0].trim()
  return CONTRACT_LABELS[first.toLowerCase()] || first
}

export function sourceInfo(id) {
  return JOB_SOURCES[id] || { label: id, logo: '', url: '' }
}
