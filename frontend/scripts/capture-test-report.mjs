// Screenshots every tool report served from docs/test-report (python -m http.server 43140 --directory docs/test-report).
import { chromium } from '@playwright/test'

const BASE = 'http://127.0.0.1:43140'
const OUT = new URL('../../docs/test-report/screenshots/', import.meta.url)

const pages = [
  ['tool1-django-tests', '/console/django-tests.html', { fullPage: true }],
  ['tool1-coverage-console', '/console/coverage-backend.html', { fullPage: true }],
  ['tool1-coverage-html', '/coverage-backend-html/index.html', { fullPage: false }],
  ['tool2-vitest-console', '/console/vitest.html', { fullPage: true }],
  ['tool2-vitest-coverage-html', '/coverage-frontend-html/index.html', { fullPage: false }],
  ['tool3-playwright-console', '/console/playwright.html', { fullPage: true }],
  ['tool3-playwright-html', '/playwright-html/index.html', { fullPage: false, wait: 1500 }],
  ['tool4-locust-console', '/console/locust.html', { fullPage: true }],
  ['tool4-locust-html', '/locust-report.html', { fullPage: false, wait: 1500 }],
  ['tool4-locust-charts', '/locust-report.html', { fullPage: false, wait: 1500, scrollTo: 'canvas, .chart, #charts, h2:has-text("Charts")' }],
  ['tool4-locust-stress-html', '/locust-stress-report.html', { fullPage: false, wait: 1500 }],
  ['tool5-lighthouse-landing-desktop', '/lighthouse/landing-desktop.report.html', { fullPage: false, wait: 5000 }],
  ['tool5-lighthouse-landing-mobile', '/lighthouse/landing-mobile.report.html', { fullPage: false, wait: 5000 }],
  ['tool5-lighthouse-login-desktop', '/lighthouse/login-desktop.report.html', { fullPage: false, wait: 5000 }],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
for (const [name, path, opts] of pages) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(opts.wait ?? 300)
  if (opts.scrollTo) {
    const target = page.locator(opts.scrollTo).first()
    if (await target.count()) await target.scrollIntoViewIfNeeded()
  }
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname.slice(1), fullPage: opts.fullPage })
  console.log('captured', name)
}
await browser.close()

