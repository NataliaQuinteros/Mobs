import { chromium, type Browser } from 'playwright'
import { config } from './config.ts'
import type { Page } from './http.ts'

// Many careers pages build their job list with JavaScript, so plain HTML shows nothing.
// This opens the page in a real browser and returns what a visitor would see.
export async function renderPage(url: string): Promise<Page | null> {
  const browser = await openBrowser()
  if (!browser) return null

  const context = await browser.newContext({ userAgent: config.scrapeUserAgent })
  try {
    const page = await context.newPage()
    // Pictures and fonts don't carry job titles, and skipping them makes this much faster.
    await page.route('**/*', (route) =>
      ['image', 'font', 'media'].includes(route.request().resourceType()) ? route.abort() : route.continue(),
    )

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.renderTimeoutMs })
    await page.waitForLoadState('networkidle', { timeout: config.renderTimeoutMs }).catch(() => {}) // some pages never go quiet
    return { url: page.url(), html: await page.content() }
  } catch {
    return null
  } finally {
    await context.close()
  }
}

let browser: Promise<Browser | null> | undefined

// One browser for the whole process, and searches carry on without it if it can't start.
function openBrowser(): Promise<Browser | null> {
  browser ??= chromium.launch().catch((err: Error) => {
    console.warn(`Reading JavaScript pages is off: ${err.message.split('\n')[0]}`)
    console.warn('Run "npx playwright install chromium" to turn it on.')
    return null
  })
  return browser
}

export async function closeBrowser(): Promise<void> {
  await (await browser)?.close()
  browser = undefined
}
