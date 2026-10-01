import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { PostingDetails } from '../../shared/types.ts'
import { fetchHtml } from './http.ts'
import { isoDate, pagePostedDate } from './postedDate.ts'
import { isJobPosting, jsonLdItems } from './postings.ts'
import { visibleText } from './words.ts'

const SUMMARY_LENGTH = 600
const cache = new Map<string, PostingDetails>() // posting pages don't change during a session

// Opens one job posting and pulls out what it is about.
export async function readPosting(url: string): Promise<PostingDetails | null> {
  const known = cache.get(url)
  if (known) return known

  const page = await fetchHtml(url)
  if (!page) return null

  const $ = cheerio.load(page.html)
  const posting = jsonLdItems($).find((item) => isJobPosting(item))
  const postedAt = isoDate(posting?.datePosted) ?? printedDate(page.html)

  const details: PostingDetails = {
    url: page.url,
    title: posting?.title ?? $('meta[property="og:title"]').attr('content') ?? $('h1').first().text().trim(),
    summary: summarise(posting?.description ? textOf(posting.description) : descriptionOf($)),
    location: [posting?.jobLocation].flat()[0]?.address?.addressLocality,
    employmentType: [posting?.employmentType].flat()[0],
    postedAt,
  }

  if (cache.size > 500) cache.clear()
  cache.set(url, details)
  return details
}

// The date the page prints, read from a parse of its own: visibleText() rearranges the document, and
// the summary still needs it whole. Only reached when the structured data gave no date.
function printedDate(html: string): string | undefined {
  const $ = cheerio.load(html)
  return pagePostedDate($, visibleText($))
}

// The page's own description, or the body text once the furniture is removed.
function descriptionOf($: CheerioAPI): string {
  const meta = $('meta[name="description"]').attr('content') ?? $('meta[property="og:description"]').attr('content')
  if (meta && meta.length > 120) return meta

  $('script, style, nav, header, footer, form, noscript').remove()
  const main = $('main, article, [role="main"]').first()
  return (main.length ? main : $('body')).text()
}

function textOf(html: string): string {
  return cheerio.load(html).text()
}

// Trimmed to whole sentences so the card doesn't end mid-word.
function summarise(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= SUMMARY_LENGTH) return clean

  const cut = clean.slice(0, SUMMARY_LENGTH)
  const lastStop = cut.lastIndexOf('. ')
  return `${lastStop > SUMMARY_LENGTH / 2 ? cut.slice(0, lastStop + 1) : cut.trimEnd()}…`
}
