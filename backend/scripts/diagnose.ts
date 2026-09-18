// Shows what happens to every website in a search, to see why results are missing.
// Usage: npx tsx scripts/diagnose.ts <lat> <lon> <radiusKm>
import pLimit from 'p-limit'
import { findCareersLink } from '../src/careersPage.ts'
import { config } from '../src/config.ts'
import { findBusinesses } from '../src/places.ts'
import { extractPostings } from '../src/postings.ts'

const [lat, lon, radiusKm] = process.argv.slice(2).map(Number)
if (!lat || !lon || !radiusKm) {
  console.error('Usage: npx tsx scripts/diagnose.ts <lat> <lon> <radiusKm>')
  process.exit(1)
}

const places = await findBusinesses(lat, lon, radiusKm)
console.log(`${places.length} websites within ${radiusKm} km (timeout ${config.siteTimeoutMs}ms, ${config.keywords.length} keywords)\n`)

const limit = pLimit(5)
const outcomes = await Promise.all(places.map((place) => limit(() => check(place.name, place.website))))

const tally = new Map<string, number>()
for (const { outcome } of outcomes) tally.set(outcome, (tally.get(outcome) ?? 0) + 1)

console.log('\nSummary:')
for (const [outcome, count] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${outcome}`)

async function check(name: string, website: string) {
  const started = Date.now()
  let res: Response
  try {
    res = await fetch(website, {
      headers: { 'User-Agent': config.scrapeUserAgent, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(config.siteTimeoutMs),
    })
  } catch (err) {
    return report(name, website, (err as Error).name === 'TimeoutError' ? 'no answer in time' : 'connection failed', started)
  }

  if (!res.ok) return report(name, website, `refused with ${res.status}`, started)
  const type = res.headers.get('content-type') ?? 'none'
  if (!type.includes('text/html')) return report(name, website, `not html (${type.split(';')[0]})`, started)

  const html = await res.text()
  const link = findCareersLink({ url: res.url, html })
  if (!link) return report(name, website, 'no link matching the keywords', started)

  const postings = await extractPostings({ url: link, html }).catch(() => [])
  return report(name, website, postings.length ? `${postings.length} postings` : 'careers page, no postings read', started)
}

function report(name: string, website: string, outcome: string, started: number) {
  console.log(`${outcome.padEnd(32)} ${String(Date.now() - started).padStart(5)}ms  ${name} — ${website}`)
  return { outcome: outcome.replace(/^\d+ postings$/, 'postings found') }
}
