import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import pLimit from 'p-limit'
import type { JobPosting } from '../../shared/types.ts'
import { config } from './config.ts'
import { fetchHtml, type Page } from './http.ts'
import { cardPostedDate, isoDate, pagePostedDate } from './postedDate.ts'
import { visibleText, wordRegex } from './words.ts'

// Tries each strategy in order and returns the first one that finds postings.
export async function extractPostings(page: Page): Promise<JobPosting[]> {
  const $ = cheerio.load(page.html)

  const fromJsonLd = jsonLdPostings($, page.url)
  if (fromJsonLd.length > 0) return notSections(fromJsonLd)

  const fromJobBoard = await jobBoardPostings(page.html)
  if (fromJobBoard.length > 0) return notSections(fromJobBoard)

  const fromLinks = notSections(await verifyPostings(linkPostings($, page.url)))
  if (fromLinks.length > 0) return fromLinks

  return notSections(await verifyPostings(cardPostings($, page.url)))
}

// 4. Job widgets mark each entry with a class of its own ("ost-job", "job-listing", "stellen-item"),
// and often link to an outside platform whose address says nothing about jobs.
function cardPostings($: CheerioAPI, pageUrl: string): JobPosting[] {
  const postings = new Map<string, JobPosting>()

  for (const card of $('[class*="job" i], [class*="stelle" i], [class*="vacan" i], [class*="offre" i]').toArray()) {
    const link = $(card).find('a[href]').first()
    const heading = $(card).find('h1, h2, h3, h4, h5, h6').first().text()
    const title = cleanTitle(heading || link.text())
    const url = URL.parse(link.attr('href') ?? '', pageUrl)

    if (title.length < 4 || title.length > 80 || isSectionName(title) || PLACEHOLDER.test(title)) continue
    postings.set(url?.href ?? title, { title, url: url?.href ?? pageUrl, postedAt: cardPostedDate($(card)) })
  }

  return [...postings.values()]
}

// Even structured data lists "Spontaneous applications" as though it were a position.
const notSections = (postings: JobPosting[]) => postings.filter((posting) => !isSectionName(posting.title))

// The link rules above are guesswork, so each candidate is opened and kept only if its page really is a
// job. Without this, "Learn more" and category links get counted as open positions.
async function verifyPostings(candidates: JobPosting[]): Promise<JobPosting[]> {
  const limit = pLimit(3)
  const checked = await Promise.all(
    candidates.slice(0, MAX_VERIFIED).map((posting) =>
      limit(async () => {
        const read = await readJobPage(posting.url)
        // A page we cannot open proves nothing, so the link rules alone decide and the posting stays.
        if (read.isJob === false) return null
        // A listing rarely dates its entries, while the posting's own page often does.
        return { ...posting, postedAt: posting.postedAt ?? read.postedAt }
      }),
    ),
  )
  return checked.filter((posting) => posting !== null)
}

const MAX_VERIFIED = 10
const APPLY_WORDS = wordRegex(
  'apply now', 'apply for this', 'apply online', 'application form', 'postuler', 'poser ma candidature',
  'jetzt bewerben', 'bewerben sie sich', 'online bewerben', 'candidati ora', 'solicitar empleo',
  'inscribirse', 'postúlate', 'inviare candidatura', 'solliciteer',
)

// Whether the candidate really is one job, and when it went up if the page says so.
// isJob true: it is a job. false: it is not. null: the page wouldn't open, so we can't say.
async function readJobPage(url: string): Promise<{ isJob: boolean | null; postedAt?: string }> {
  const page = await fetchHtml(url, config.siteTimeoutMs * 2) // a known page deserves more patience
  if (!page) return { isJob: null }

  const $ = cheerio.load(page.html)
  const posting = jsonLdItems($).find((item) => isJobPosting(item))

  // visibleText strips the <script> blocks the structured data lives in, so that is read first.
  const text = visibleText($)
  const postedAt = isoDate(posting?.datePosted) ?? pagePostedDate($, text)
  if (posting) return { isJob: true, postedAt }

  // Field labels settle it: only a single job states its start date or contract type. This is checked
  // before the link count, because job pages often carry a long list of similar positions.
  if (JOB_FIELDS.test(text)) return { isJob: true, postedAt }
  if ($('form').filter((_, form) => $(form).find('input[type="file"]').length > 0).length > 0) return { isJob: true, postedAt }

  // Otherwise, a page pointing at many jobs is the list, not one of them.
  const jobLinks = $('a[href]').toArray().filter((a) => JOB_PATH.test(URL.parse($(a).attr('href')!, url)?.pathname ?? ''))
  if (jobLinks.length >= 6) return { isJob: false }

  return { isJob: APPLY_WORDS.test(text), postedAt }
}

// Field labels a single job description carries. Deliberately narrow: wording like "we offer" or
// "requirements" also appears on benefits pages.
const JOB_FIELDS = wordRegex(
  'employment type', 'contract type', 'workload', 'start date', 'entry date', 'job details',
  'pensum', 'arbeitsort', 'eintrittsdatum', 'startdatum', 'vertragsart', 'anstellungsart',
  'beschäftigungsgrad', 'jobdetails', 'taux d’activité', "taux d'activité", 'type de contrat',
  'lieu de travail', 'date d’entrée', 'date de début', 'tipo de contrato', 'jornada laboral',
  'lugar de trabajo', 'fecha de inicio', 'orario di lavoro', 'luogo di lavoro', 'tipo di contratto',
)

// Every schema.org entry a page publishes, flattened out of its <script type="application/ld+json"> blocks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-LD is free-form
export function jsonLdItems($: CheerioAPI): any[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => {
      try {
        return [JSON.parse($(script).text())].flat().flatMap((data) => data['@graph'] ?? data)
      } catch {
        return []
      }
    })
}

export const isJobPosting = (item: { '@type'?: string | string[] }) => [item?.['@type']].flat().includes('JobPosting')

// 1. Structured data: <script type="application/ld+json"> with schema.org JobPosting
function jsonLdPostings($: CheerioAPI, pageUrl: string): JobPosting[] {
  return jsonLdItems($)
    .filter((item) => isJobPosting(item) && item.title)
    .map((item) => ({
      title: item.title,
      url: URL.parse(item.url ?? '', pageUrl)?.href ?? pageUrl,
      location: [item.jobLocation].flat()[0]?.address?.addressLocality,
      postedAt: isoDate(item.datePosted),
    }))
}

// 2. Hosted job boards with public APIs. To support another board, add an entry.
const jobBoards = [
  {
    // boards.greenhouse.io/acme, job-boards.eu.greenhouse.io/acme or boards.greenhouse.io/embed/job_board?for=acme
    pattern: /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([\w-]+)/,
    apiUrl: (company: string) => `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`,
    // updated_at moves whenever anyone edits the advert, so it only stands in when the board omits
    // the day the job first went up.
    parse: (data: any): JobPosting[] =>
      data.jobs.map((job: any) => ({
        title: job.title,
        url: job.absolute_url,
        location: job.location?.name,
        postedAt: isoDate(job.first_published ?? job.updated_at),
      })),
  },
  {
    // jobs.lever.co/acme
    pattern: /jobs\.lever\.co\/([\w-]+)/,
    apiUrl: (company: string) => `https://api.lever.co/v0/postings/${company}?mode=json`,
    parse: (data: any): JobPosting[] =>
      data.map((job: any) => ({
        title: job.text,
        url: job.hostedUrl,
        location: job.categories?.location,
        postedAt: isoDate(job.createdAt), // milliseconds since the epoch
      })),
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
const JOB_PATH = /\/(jobs?|careers?|positions?|vacanc|opening|stellen|emplo|lavoro|vagas)[\w-]*\/[\w-]{3,}\/?$/i

const DOWNLOAD = /\.(mp4|webm|mp3|pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?)$/i
// Placeholders a site left unfilled, such as [#DSR_FORM_URL_TEXT#] or {{job.title}}
const PLACEHOLDER = /\[#.*#\]|\{\{.*\}\}|\$\{.*\}|%[A-Z_]{4,}%/

function linkPostings($: CheerioAPI, pageUrl: string): JobPosting[] {
  const postings = new Map<string, JobPosting>()
  const pagePath = new URL(pageUrl).pathname.replace(/\/$/, '')

  for (const a of $('a[href]').toArray()) {
    if ($(a).closest('nav, header, footer, [role="navigation"]').length > 0) continue

    const url = URL.parse($(a).attr('href')!, pageUrl)
    const title = linkTitle($, a)

    if (!url || title.length < 4 || title.length > 80 || DOWNLOAD.test(url.pathname)) continue
    if (!JOB_PATH.test(url.pathname) && !isBelow(url.pathname, pagePath)) continue
    if (isMenuItem(url.pathname, pagePath) || isSectionName(title) || PLACEHOLDER.test(title)) continue

    postings.set(url.href, { title, url: url.href, postedAt: cardPostedDate($(a).closest('article, li, div')) })
  }

  return [...postings.values()]
}

// The link's own words, or the card's heading when the link is an invisible overlay across a job card.
function linkTitle($: CheerioAPI, link: Element): string {
  $(link).find('*').after(' ') // keep nested tags apart: <p>Engineer</p><p>Madrid</p> → "Engineer Madrid"
  const own = cleanTitle($(link).text())
  if (own.length >= 4) return own

  const card = $(link).closest('article, li, div')
  return cleanTitle(card.find('h1, h2, h3, h4, h5, h6').first().text())
}

// Pages under the careers page are worth checking whatever their address says: Chicorée lists its
// openings at /de/arbeiten-bei-chicoree/verkauf/id/34/, which carries no job word at all.
function isBelow(linkPath: string, pagePath: string): boolean {
  return pagePath.length > 1 && linkPath.startsWith(`${pagePath}/`) && linkPath.length > pagePath.length + 1
}

// A page next to the careers page ("/en/career/students" beside "/en/career/job-vacancies") is a menu
// entry, not a job. Real postings sit below the listing, or in a section of their own.
function isMenuItem(linkPath: string, pagePath: string): boolean {
  const parent = (path: string) => path.replace(/\/[^/]*\/?$/, '')
  return parent(linkPath) === parent(pagePath) && !linkPath.startsWith(`${pagePath}/`)
}

// "Job vacancies", "Careers", "Empleo"… name a section of the site rather than a position.
function isSectionName(title: string): boolean {
  if (wordRegex(...config.keywords, ...SECTIONS).test(title)) return true

  // A department filter ("Engineering", "Data & Analytics") lists jobs, it isn't one. A real title says
  // what the job is, as in "Engineering Manager", so only reject titles made up purely of department names.
  const parts = title.toLowerCase().split(/[&/,]|\band\b/)
  return parts.every((part) => DEPARTMENTS.includes(part.trim()))
}

const SECTIONS = [
  'students', 'apprenticeship', 'graduates', 'internship', 'faq', 'faqs', 'application process',
  // an open application is a way to apply, not a position: the CV route covers it
  'spontaneous application', 'spontaneous applications', 'unsolicited application', 'open application',
  'open applications', 'candidature spontanée', 'candidatures spontanées', 'initiativbewerbung',
  'candidatura espontánea', 'autocandidatura',
  // buttons and page furniture that carry no job title
  'apply', 'postuler', 'bewerben', 'skip to main content', 'skip to content', 'more information',
  'plus d’informations', "plus d'informations", 'mehr informationen', 'más información',
  'rejoins l’équipe', "rejoins l'équipe", 'rejoignez-nous', 'view job', 'see job', 'voir l’offre', "voir l'offre",
  'benefits', 'avantages', 'vorteile', 'vorteilen', 'ventajas', 'vantaggi', 'portraits', 'témoignages', 'testimonials',
  // "read more" links carry no job title at all
  'learn more', 'read more', 'find out more', 'en savoir plus', 'mehr erfahren', 'weiterlesen',
  'leer más', 'ver más', 'saber más', 'scopri di più', 'meer informatie', 'details',
  // shops and locations, not positions
  'märkte', 'markt', 'filialen', 'filiale', 'stores', 'shops', 'centres', 'centrale', 'zentrale',
  // headings of the list itself, job alerts, and bare controls
  'postes ouverts', 'nos postes ouverts', 'offene stellen', 'open positions', 'alle jobs',
  'job-abo', 'job abo', 'jobabo', 'job alert', 'jobalarm', 'alerte emploi',
  'hier', 'here', 'show more', 'show more options', 'mehr anzeigen', 'voir plus', 'ver todo',
]

// Cards often start with when the advert went up: "Publiée le 18 septembre 2026 Réceptionniste".
// The date is spelled out rather than skipped to the next capital, because \p{Lu} under /i matches any letter.
const DATE_PREFIX =
  /^(publiée?\s+le|en\s+ligne\s+depuis\s+le|posted\s+on|veröffentlicht\s+am|pubblicato\s+il)\s+\d{1,2}[.\s]*\p{L}{3,12}\.?\s*\d{2,4}/iu

const cleanTitle = (text: string) => text.replace(/\s+/g, ' ').trim().replace(DATE_PREFIX, '').trim()

const DEPARTMENTS = [
  'engineering', 'data', 'analytics', 'finance', 'legal', 'marketing', 'sales', 'design', 'product',
  'people', 'hr', 'human resources', 'operations', 'customer support', 'customer success', 'support',
  'it', 'technology', 'research', 'executive leadership', 'leadership', 'communications', 'security',
  'administration', 'logistics', 'quality', 'consulting', 'production', 'management',
]
