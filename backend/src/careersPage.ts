import * as cheerio from 'cheerio'
import { config } from './config.ts'
import { fetchHtml, type Page } from './http.ts'

// Finds the page on a business website that lists its jobs.
export async function findCareersPage(website: string): Promise<Page | null> {
  const home = await fetchHtml(website)
  const link = home && findCareersLink(home)
  return link ? fetchHtml(link) : null
}

// Picks the link whose text or URL matches the highest-ranked keyword.
export function findCareersLink({ url, html }: Page): string | null {
  const $ = cheerio.load(html)
  let best: { rank: number; href: string } | null = null

  for (const a of $('a[href]').toArray()) {
    const href = $(a).attr('href')!
    if (/^(mailto|tel|javascript):|^#/i.test(href)) continue

    const text = $(a).text().toLowerCase()
    const rank = config.keywords.findIndex((keyword) => {
      const slug = keyword.replaceAll(' ', '-')
      return new RegExp(`\\b${keyword}\\b`).test(text) || new RegExp(`[/.]${slug}\\b`, 'i').test(href)
    })
    if (rank !== -1 && (!best || rank < best.rank)) best = { rank, href }
  }

  return best ? (URL.parse(best.href, url)?.href ?? null) : null
}
