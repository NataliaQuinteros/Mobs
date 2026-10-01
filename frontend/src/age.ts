import type { JobPosting } from '../../shared/types.ts'

const DAY_MS = 86_400_000

// Past this, an advert is old enough to be worth a warning: many are filled or withdrawn by then.
export const STALE_DAYS = 30

// How long ago the advert went up, or undefined when the site never said — which is most of them.
export function ageInDays(postedAt?: string): number | undefined {
  if (!postedAt) return undefined

  const at = new Date(postedAt).getTime()
  if (Number.isNaN(at)) return undefined

  return Math.max(0, Math.floor((Date.now() - at) / DAY_MS))
}

// Pinned to English: the rest of the page is English, and the machine's own locale would otherwise
// leave it reading "posted hace 4 meses".
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

// "today", "3 days ago", "last month" — the rougher the older, as nobody counts days past a month.
export function describeAge(days: number): string {
  if (days < 7) return relative.format(-days, 'day')
  if (days < 31) return relative.format(-Math.round(days / 7), 'week')
  if (days < 365) return relative.format(-Math.round(days / 30), 'month')
  return relative.format(-Math.round(days / 365), 'year')
}

export const AGE_FILTERS = [
  { label: 'any time', days: null },
  { label: 'last 7 days', days: 7 },
  { label: 'last 30 days', days: 30 },
  { label: 'last 3 months', days: 90 },
]

// A posting is dropped only when we know it is too old. One with no date is of unknown age, not an old
// one, and hiding those would hide most of the small businesses this search is for.
export function freshPostings(postings: JobPosting[], maxAgeDays: number | null): JobPosting[] {
  if (maxAgeDays === null) return postings
  return postings.filter((posting) => (ageInDays(posting.postedAt) ?? 0) <= maxAgeDays)
}
