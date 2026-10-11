import { expect, test } from '@playwright/test'

const SHOTS = '../docs/test-report/screenshots'
const DEMO = { username: 'karim', password: 'Demo1234!' }
const ADMIN = { username: 'admin', password: 'Admin1234!' }

const OFFER = `Développeur Full-Stack Python / React (H/F)
Nous recherchons un développeur full-stack pour notre équipe produit.
Compétences : Python, Django, Django REST Framework, React, JavaScript, PostgreSQL, Docker, Git, CI/CD.
Expérience : 2 ans minimum. Télétravail partiel possible.`

function buildPdf(lines) {
  const content = `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((l) => `(${l}) Tj T*`).join(' ')} ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((off) => {
    out += `${String(off).padStart(10, '0')} 00000 n \n`
  })
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out, 'latin1')
}

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(700)
}

async function shot(page, name, fullPage = false) {
  await settle(page)
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage })
}

async function login(page, { username, password }) {
  await page.goto('/connexion')
  await page.getByLabel('Nom d’utilisateur').fill(username)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('**/dashboard')
}

test.describe('Public pages', () => {
  test('E2E-01 landing page renders hero and call-to-action', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('ResumeMatch')
    await expect(page.getByRole('link', { name: /Analyser mon CV/ })).toBeVisible()
    await shot(page, 'e2e-01-landing')
  })

  test('E2E-02 protected route redirects anonymous users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/connexion')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connexion')
    await shot(page, 'e2e-02-login-redirect')
  })

  test('E2E-03 login with wrong password shows an error', async ({ page }) => {
    await page.goto('/connexion')
    await page.getByLabel('Nom d’utilisateur').fill('karim')
    await page.getByLabel('Mot de passe').fill('wrong-password')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.locator('form')).toContainText(/identifiants|incorrect|invalide|No active account/i)
    await expect(page).toHaveURL(/\/connexion$/)
    await shot(page, 'e2e-03-login-error')
  })

  test('E2E-04 registration creates an account and opens the dashboard', async ({ page }) => {
    const id = Date.now().toString(36)
    await page.goto('/inscription')
    await page.locator('input[name=username]').fill(`e2e_${id}`)
    await page.locator('input[name=email]').fill(`e2e_${id}@example.com`)
    await page.locator('input[name=first_name]').fill('Test')
    await page.locator('input[name=last_name]').fill('Playwright')
    await page.locator('input[name=password]').fill('E2ePass!2026x')
    await page.locator('input[name=password_confirm]').fill('E2ePass!2026x')
    await shot(page, 'e2e-04a-register-form')
    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await page.waitForURL('**/dashboard')
    await shot(page, 'e2e-04b-register-dashboard')
  })
})

test.describe('Candidate journey', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO)
  })

  test('E2E-05 dashboard shows statistics and score timeline', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Tableau de bord|Dashboard/)
    await expect(page.locator('main')).toContainText(/Analyses/i)
    await shot(page, 'e2e-05-dashboard', true)
  })

  test('E2E-06 upload a PDF CV in the analysis wizard', async ({ page }) => {
    await page.goto('/analyse')
    await page.locator('input[type=file]').setInputFiles({
      name: 'CV_Playwright.pdf',
      mimeType: 'application/pdf',
      buffer: buildPdf([
        'Test Playwright - Developpeur Full Stack',
        'Competences: Python, Django, React, JavaScript, SQL, Docker, Git',
        'Experience: 2 ans developpeur web',
      ]),
    })
    await expect(page.getByRole('button', { name: /CV_Playwright/ }).first()).toBeVisible()
    await shot(page, 'e2e-06-cv-upload')
  })

  test('E2E-07 run a full CV / job offer analysis', async ({ page }) => {
    await page.goto('/analyse')
    await page.locator('ul button').first().click()
    await page.getByRole('button', { name: /Continuer/ }).click()
    await page.locator('textarea').fill(OFFER)
    await page.getByPlaceholder('Développeur Python').fill('Développeur Full-Stack')
    await page.getByPlaceholder('Acme').fill('Playwright SA')
    await shot(page, 'e2e-07a-wizard-offer')
    await page.getByRole('button', { name: /Continuer/ }).click()
    await page.getByRole('button', { name: /Continuer/ }).click()
    await shot(page, 'e2e-07b-wizard-summary')
    const started = Date.now()
    await page.getByRole('button', { name: /Lancer l’analyse/ }).click()
    await page.waitForURL(/\/resultats\/\d+/, { timeout: 30_000 })
    test.info().annotations.push({ type: 'analysis-ms', description: String(Date.now() - started) })
    await expect(page.locator('main')).toContainText('/ 100')
    await shot(page, 'e2e-07c-results', true)
  })

  test('E2E-08 history lists previous analyses', async ({ page }) => {
    await page.goto('/historique')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Historique')
    await expect(page.locator('main a[href^="/resultats/"]').first()).toBeVisible()
    await shot(page, 'e2e-08-history')
  })

  test('E2E-09 application board shows status columns', async ({ page }) => {
    await page.goto('/candidatures')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/candidatures/i)
    await shot(page, 'e2e-09-board')
  })

  test('E2E-10 compare page and job search page load', async ({ page }) => {
    await page.goto('/comparer')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot(page, 'e2e-10a-compare')
    await page.goto('/offres')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot(page, 'e2e-10b-job-search')
  })

  test('E2E-11 profile page shows the user information', async ({ page }) => {
    await page.goto('/profil')
    await expect(page.locator('main')).toContainText(/karim/i)
    await shot(page, 'e2e-11-profile')
  })

  test('E2E-12 non-admin users cannot open the admin console', async ({ page }) => {
    await page.goto('/administration')
    await expect(page).not.toHaveURL(/\/administration$/)
  })

  test('E2E-13 language switch translates the interface', async ({ page }) => {
    await page.getByRole('button', { name: 'en', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dashboard')
    await shot(page, 'e2e-13-english')
    await page.getByRole('button', { name: 'fr', exact: true }).click()
  })
})

test.describe('Administration & responsive', () => {
  test('E2E-14 admin console shows platform overview', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/administration')
    await expect(page).toHaveURL(/\/administration$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot(page, 'e2e-14-admin', true)
  })

  test('E2E-15 mobile layout (iPhone-size viewport)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await login(page, DEMO)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot(page, 'e2e-15-mobile-dashboard')
    await context.close()
  })
})
