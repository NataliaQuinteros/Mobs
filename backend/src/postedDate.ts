import type { Cheerio } from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'

// When an advert went up. Plenty of business sites say nothing at all, so every reader here returns
// undefined rather than a guess: an undated posting is of unknown age, which is not the same as old.

const DAY_MS = 86_400_000
const EARLIEST = Date.UTC(2000, 0, 1) // a job advert older than this is a parsing mistake, not a vacancy

// Anything a date can be read from: an ISO string, a timestamp in milliseconds, a Date. Trimmed to the
// day, because that is as precise as "older than 30 days" ever needs.
export function isoDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined

  const at = value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value))
  const time = at.getTime()
  if (Number.isNaN(time) || time < EARLIEST || time > Date.now() + DAY_MS) return undefined

  return at.toISOString().slice(0, 10)
}

// The date a whole posting page states. <time> and the meta tags are the machine-readable ones; the
// words are the fallback. `text` is the page's visible text, which the caller already has.
export function pagePostedDate($: CheerioAPI, text: string): string | undefined {
  const meta = $('meta[property="article:published_time"], meta[itemprop="datePosted"], meta[name="date"]').attr('content')
  const time = $('time[datetime]').first().attr('datetime')
  return isoDate(meta) ?? isoDate(time) ?? wordedDate(text)
}

// The date one entry in a list of jobs carries, such as "Publiée le 18 septembre 2026" above its title.
export function cardPostedDate(card: Cheerio<AnyNode>): string | undefined {
  const time = card.find('time[datetime]').first().attr('datetime')
  return isoDate(time) ?? wordedDate(card.text())
}

// A date written out in words, either stated ("Posted on 12 March 2026") or counted back from today
// ("il y a 3 jours"). Only dates introduced by one of these labels count: a page is full of other
// numbers, and the copyright line alone would date every posting to January.
export function wordedDate(text: string): string | undefined {
  const labelled = new RegExp(`(?:${LABELS})[\\s:]*(${DATE_SHAPES})`, 'iu').exec(text)
  return (labelled && statedDate(labelled[1])) ?? countedBackDate(text)
}

const LABELS = [
  'published(?:\\s+on)?', 'posted(?:\\s+on)?', 'online since', 'date posted',
  'publiée?\\s+le', 'mise en ligne le', 'en ligne depuis le', 'date de publication',
  'veröffentlicht am', 'online seit(?:\\s+dem)?', 'publikationsdatum',
  'pubblicato il', 'publicado el', 'fecha de publicación', 'gepubliceerd op',
].join('|')

const DATE_SHAPES = [
  '\\d{4}-\\d{2}-\\d{2}', // 2026-09-18
  '\\d{1,2}[./]\\d{1,2}[./]\\d{2,4}', // 18.09.2026
  '\\d{1,2}\\.?\\s*\\p{L}{3,12}\\.?\\s*\\d{4}', // 18 septembre 2026, 3. März 2026
  '\\p{L}{3,12}\\.?\\s*\\d{1,2},?\\s*\\d{4}', // March 12, 2026
].join('|')

function statedDate(written: string): string | undefined {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(written)
  if (iso) return isoDate(written)

  // Day first: the sites this reads are European, where 03/04 is the third of April.
  const numeric = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(written)
  if (numeric) {
    const [day, month, year] = numeric.slice(1).map(Number)
    return dayToIso(year < 100 ? 2000 + year : year, month, day)
  }

  const named = /(\d{1,2})\.?\s*(\p{L}{3,12})|(\p{L}{3,12})\.?\s*(\d{1,2})/u.exec(written)
  const month = MONTHS.get(plain(named?.[2] ?? named?.[3] ?? ''))
  const year = /\d{4}/.exec(written.slice(named?.index ?? 0))

  return month && year ? dayToIso(Number(year[0]), month, Number(named?.[1] ?? named?.[4])) : undefined
}

function dayToIso(year: number, month: number, day: number): string | undefined {
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return undefined
  return isoDate(new Date(Date.UTC(year, month - 1, day)))
}

// "3 days ago", "il y a 3 jours", "vor 5 Tagen", "hace 2 semanas", "2 maanden geleden".
function countedBackDate(text: string): string | undefined {
  for (const [unit, days] of UNITS) {
    const match = new RegExp(`(?<![\\p{L}\\p{N}])(\\d{1,3})\\s*(?:${unit})(?![\\p{L}\\p{N}])`, 'iu').exec(text)
    if (!match) continue

    // The count alone says nothing — "30 days holiday" is not a date. Some languages put the marker in
    // front ("vor 5 Tagen"), others behind ("5 days ago"), so both sides of the match are looked at.
    const around = text.slice(Math.max(0, match.index - 12), match.index + match[0].length + 12)
    if (AGO.test(around)) return isoDate(Date.now() - Number(match[1]) * days * DAY_MS)
  }
  return undefined
}

const UNITS: [string, number][] = [
  ['days?|jours?|tage?n?|d[ií]as?|giorni?|dagen?', 1],
  ['weeks?|semaines?|wochen?|semanas?|settimane?|weken', 7],
  ['months?|mois|monate?n?|meses|mesi|maanden?', 30],
]

const AGO = /(?<![\p{L}\p{N}])(ago|il y a|vor|hace|fa|geleden|depuis)(?![\p{L}\p{N}])/iu

// Month names for the languages this app looks at, built from the calendar rather than typed out:
// "septembre" → 9, "März" → 3, "sept." → 9. The short forms agree across these languages.
const MONTHS = monthNames(['en', 'fr', 'de', 'es', 'it', 'pt', 'nl'])

function monthNames(locales: string[]): Map<string, number> {
  const names = new Map<string, number>()

  for (const locale of locales) {
    for (const width of ['long', 'short'] as const) {
      const format = new Intl.DateTimeFormat(locale, { month: width, timeZone: 'UTC' })
      for (let month = 0; month < 12; month++) {
        names.set(plain(format.format(new Date(Date.UTC(2026, month, 15)))), month + 1)
      }
    }
  }

  return names
}

// Accents and the trailing dot of a short form are noise when matching a month by name.
function plain(text: string) {
  return text.normalize('NFD').replace(/\p{M}|\./gu, '').toLowerCase()
}
