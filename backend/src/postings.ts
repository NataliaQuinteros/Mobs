import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { JobPosting } from '../../shared/types.ts'
import type { Page } from './http.ts'

// Tries each strategy in order and returns the first one that finds postings.
export async function extractPostings(page: Page): Promise<JobPosting[]> {
  const $ = cheerio.load(page.html)

  const fromJsonLd = jsonLdPostings($, page.url)
  if (fromJsonLd.length > 0) return fromJsonLd

  const fromJobBoard = await jobBoardPostings(page.html)
  if (fromJobBoard.length > 0) return fromJobBoard

  return linkPostings($, page.url)
}

// 1. Structured data: <script type="application/ld+json"> with schema.org JobPosting
function jsonLdPostings($: CheerioAPI, pageUrl: string): JobPosting[] {
  const items = $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => {
      try {
        return [JSON.parse($(script).text())].flat().flatMap((data) => data['@graph'] ?? data)
      } catch {
        return []
      }
    })

  return items
    .filter((item) => [item?.['@type']].flat().includes('JobPosting') && item.title)
    .map((item) => ({
      title: item.title,
      url: URL.parse(item.url ?? '', pageUrl)?.href ?? pageUrl,
      location: [item.jobLocation].flat()[0]?.address?.addressLocality,
    }))
}

// 2. Hosted job boards with public APIs. To support another board, add an entry.
const jobBoards = [
  {
    // boards.greenhouse.io/acme, job-boards.eu.greenhouse.io/acme or boards.greenhouse.io/embed/job_board?for=acme
    pattern: /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([\w-]+)/,
    apiUrl: (company: string) => `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`,
    parse: (data: any): JobPosting[] =>
      data.jobs.map((job: any) => ({ title: job.title, url: job.absolute_url, location: job.location?.name })),
  },
  {
    // jobs.lever.co/acme
    pattern: /jobs\.lever\.co\/([\w-]+)/,
    apiUrl: (company: string) => `https://api.lever.co/v0/postings/${company}?mode=json`,
    parse: (data: any): JobPosting[] =>
      data.map((job: any) => ({ title: job.text, url: job.hostedUrl, location: job.categories?.location })),
  },
]

async function jobBoardPostings(html: string): Promise<JobPosting[]> {
  for (const board of jobBoards) {
    const match = html.match(board.pattern)
    if (!match) continue
    const res = await fetch(board.apiUrl(match[1]), { signal: AbortSignal.timeout(8000) })
    if (res.ok) return board.parse(await res.json())
  }
  return []
}

// 3. Fallback: links that look like individual job pages, e.g. /jobs/frontend-developer
// (the slug must be the last path segment, so /careers/media/video.mp4 doesn't count)
const JOB_PATH = /\/(jobs?|careers?|positions?|vacanc(y|ies)|openings?)\/[\w-]{3,}\/?$/i

function linkPostings($: CheerioAPI, pageUrl: string): JobPosting[] {
  const postings = new Map<string, JobPosting>()

  for (const a of $('a[href]').toArray()) {
    const url = URL.parse($(a).attr('href')!, pageUrl)
    $(a).find('*').after(' ') // keep nested tags apart: <p>Engineer</p><p>Madrid</p> → "Engineer Madrid"
    const title = $(a).text().replace(/\s+/g, ' ').trim()
    if (!url || !JOB_PATH.test(url.pathname) || title.length < 4 || title.length > 80) continue
    postings.set(url.href, { title, url: url.href })
  }

  return [...postings.values()]
}
