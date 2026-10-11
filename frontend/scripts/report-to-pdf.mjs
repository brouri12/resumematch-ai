// Prints an HTML report to PDF (default docs/test-report/TECHNICAL_REPORT.html) and saves a preview of the first page.
// Usage: node scripts/report-to-pdf.mjs [path/to/report.html]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const defaultHtml = fileURLToPath(new URL('../../docs/test-report/TECHNICAL_REPORT.html', import.meta.url))
const html = resolve(process.argv[2] ?? defaultHtml)
const pdf = html.replace(/\.html$/, '.pdf')
const rawDir = `${dirname(html)}/raw`
mkdirSync(rawDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
await page.goto(pathToFileURL(html).href, { waitUntil: 'load' })
const title = await page.title()
await page.pdf({
  path: pdf,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    `<div style="font-size:8px;width:100%;text-align:center;color:#6b7f76">${title} · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
})
await page.screenshot({ path: `${rawDir}/${pdf.split(/[\\/]/).pop().replace(/\.pdf$/, '')}-preview.png` })
await browser.close()
console.log('wrote', pdf)
