import pLimit from 'p-limit'
import type { JobPosting, SearchEvent, SearchParams } from '../../shared/types.ts'
import { findCvTarget } from './applications.ts'
import { findCareersLink, findCareersPage } from './careersPage.ts'
import { config } from './config.ts'
import { fetchHtml, type Page } from './http.ts'
import { findBusinesses } from './places.ts'
import { extractPostings } from './postings.ts'
import { renderPage } from './render.ts'

const limit = pLimit(5) // websites scraped at the same time
const browserLimit = pLimit(config.renderConcurrency) // browser tabs are far heavier than plain requests

type CareersPage = { careersUrl: string; postings: JobPosting[]; cvUrl?: string }

// What a careers page offers. Two things often hide the jobs: the page may only introduce the section,
// with the list behind a further link ("Offres d'emploi" on a "Carrière" page), and the list itself may
// be built by JavaScript. So a second page is tried, and both are opened in a browser before giving up.
export async function readCareersPage(start: Page): Promise<CareersPage> {
  const urls = [start.url, listingLink(start)].filter((url) => url !== null)
  const seen: Page[] = []

  // The business's own page is exhausted first, browser included: a further link often leads to a parent
  // company or another country, whose jobs are not the ones nearby.
  for (const url of urls) {
    for (const page of [url === start.url ? start : await fetchHtml(url), await render(url)]) {
      if (!page) continue
      const postings = await extractPostings(page).catch(() => [])
      if (postings.length > 0) return { careersUrl: page.url, postings }
      seen.push(page)
    }
  }

  // No positions anywhere: offer the first page that takes a CV, the business's own before any other.
  for (const page of seen) {
    const cvUrl = findCvTarget(page)
    if (cvUrl) return { careersUrl: page.url, postings: [], cvUrl }
  }
  return { careersUrl: start.url, postings: [] }
}

const render = (url: string) => (config.renderJs ? browserLimit(() => renderPage(url)) : null)

// The link on a careers page that leads to the list of open positions.
function listingLink(page: Page): string | null {
  const link = findCareersLink(page)
  if (!link || sameTarget(link, page.url) || JOB_AGGREGATORS.test(new URL(link).hostname)) return null
  return link
}

const sameTarget = (a: string, b: string) => a.replace(/\/$/, '') === b.replace(/\/$/, '')

// Their listings are worldwide and not this business's own.
const JOB_AGGREGATORS = /(^|\.)(linkedin|indeed|glassdoor|facebook|instagram|x|twitter|monster|stepstone|jobup|jobs)\.(com|ch|de|fr|es|it|co\.uk)$/i

// Reports each business as soon as its careers page is found, instead of waiting for all of them.
export async function search(
  { lat, lon, radiusKm }: SearchParams,
  onEvent: (event: SearchEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const places = await findBusinesses(lat, lon, radiusKm)
  onEvent({ type: 'scanning', siteCount: places.length })

  await Promise.all(
    places.map((place) =>
      limit(async () => {
        if (signal.aborted) return

        const page = await findCareersPage(place.website)
        if (!page) return

        const read = await readCareersPage(page)

        // Only worth showing when you can actually apply: open positions, or somewhere to send a CV.
        if (read.postings.length === 0 && !read.cvUrl) return
        if (!signal.aborted) onEvent({ type: 'business', business: { ...place, ...read } })
      }),
    ),
  )
}
