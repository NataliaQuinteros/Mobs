import * as cheerio from 'cheerio'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardPostedDate, isoDate, pagePostedDate, wordedDate } from '../src/postedDate.ts'

afterEach(() => vi.useRealTimers())

describe('isoDate', () => {
  it('reads what the job boards send', () => {
    expect(isoDate('2026-09-01')).toBe('2026-09-01') // greenhouse first_published
    expect(isoDate(1789580636068)).toBe('2026-09-16') // lever createdAt, in milliseconds
    expect(isoDate('2026-09-16T17:43:56.068Z')).toBe('2026-09-16')
  })

  it('keeps nonsense out', () => {
    expect(isoDate('Frontend Developer')).toBeUndefined()
    expect(isoDate(undefined)).toBeUndefined()
    expect(isoDate('1998-04-02')).toBeUndefined() // older than the web this reads
    expect(isoDate(Date.now() + 30 * 86_400_000)).toBeUndefined() // adverts are not posted next month
  })
})

describe('wordedDate', () => {
  it('reads a date the page states, in the languages the search covers', () => {
    expect(wordedDate('Publiée le 18 septembre 2026 · Réceptionniste')).toBe('2026-09-18')
    expect(wordedDate('Veröffentlicht am 3. März 2026')).toBe('2026-03-03')
    expect(wordedDate('Posted on March 12, 2026')).toBe('2026-03-12')
    expect(wordedDate('Pubblicato il 18.09.2026')).toBe('2026-09-18')
    expect(wordedDate('Date posted: 2026-09-18')).toBe('2026-09-18')
  })

  it('counts back from wording that gives an age instead of a date', () => {
    vi.setSystemTime(new Date('2026-09-22T10:00:00Z'))

    expect(wordedDate('Frontend Developer · posted 3 days ago')).toBe('2026-09-19')
    expect(wordedDate('Stellenangebot vor 5 Tagen veröffentlicht')).toBe('2026-09-17')
    expect(wordedDate('Publicado hace 2 semanas')).toBe('2026-09-08')
  })

  it('leaves the other numbers on the page alone', () => {
    expect(wordedDate('We offer 30 days of holiday and a 13th salary')).toBeUndefined()
    expect(wordedDate('© 2026 Acme AG. All rights reserved.')).toBeUndefined()
    expect(wordedDate('Barista wanted, 80-100%')).toBeUndefined()
  })
})

describe('reading a date off the markup', () => {
  it('prefers the machine-readable date on a posting page', () => {
    const $ = cheerio.load('<meta property="article:published_time" content="2026-08-04T09:00:00Z"><body>Publiée le 1 janvier 2026</body>')
    expect(pagePostedDate($, $('body').text())).toBe('2026-08-04')
  })

  it('falls back to the words when nothing is tagged', () => {
    const $ = cheerio.load('<body><p>En ligne depuis le 07/09/2026</p></body>')
    expect(pagePostedDate($, $('body').text())).toBe('2026-09-07')
  })

  it('reads the date of one card in a list', () => {
    const $ = cheerio.load('<li class="job"><time datetime="2026-09-18">18.09.</time><h3>Réceptionniste</h3></li>')
    expect(cardPostedDate($('li'))).toBe('2026-09-18')
  })
})
