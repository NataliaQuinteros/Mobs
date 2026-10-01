import * as cheerio from 'cheerio'
import { config } from './config.ts'
import { fetchHtml, type Page } from './http.ts'
import { wordRegex } from './words.ts'

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

    // On jobs.company.com every link's address contains "jobs", so only the path counts once we are
    // already on that host. Otherwise the language switcher outranks the real jobs link.
    const target = URL.parse(href, url)
    const address = target?.hostname === new URL(url).hostname ? target.pathname : href

    const text = $(a).text().toLowerCase()
    const rank = config.keywords.findIndex((keyword) => {
      const slug = unaccented(keyword).replaceAll(' ', '-')
      return wordRegex(keyword).test(text) || new RegExp(`[/.]${slug}(?![\\p{L}\\p{N}])`, 'iu').test(unaccented(address))
    })
    if (rank !== -1 && (!best || rank < best.rank)) best = { rank, href }
  }

  return best ? (URL.parse(best.href, url)?.href ?? null) : null
}

// Addresses drop the accents their words carry: "postes à pourvoir" lives at /postes-a-pourvoir,
// "carrières" at /carrieres. The link text keeps them, so only the address is folded.
const unaccented = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '')
