import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout } from 'node:timers/promises'
import type { Business } from '../../shared/types.ts'
import { config } from './config.ts'

export type Place = Omit<Business, 'careersUrl' | 'postings'>

type OverpassElement = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags: Record<string, string>
}

// Tags mappers use for a website, most to least specific. "brand:website" is the chain's own site.
export const WEBSITE_TAGS = ['website', 'contact:website', 'brand:website', 'url']

type Candidate = { id: string; name: string; lat: number; lon: number; website: string }

// Named places with a website within the radius, closest first, one per domain.
export async function findBusinesses(lat: number, lon: number, radiusKm: number): Promise<Place[]> {
  const candidates = localPlaces(lat, lon, radiusKm) ?? (await overpassPlaces(lat, lon, radiusKm))

  const byDomain = new Map<string, Place>()
  for (const candidate of candidates) {
    const website = parseWebsite(candidate.website)
    if (!website) continue

    const place = {
      id: candidate.id,
      name: candidate.name,
      website: website.href,
      lat: candidate.lat,
      lon: candidate.lon,
      distanceKm: distanceKm(lat, lon, candidate.lat, candidate.lon),
    }
    if (place.distanceKm > radiusKm) continue

    const domain = website.hostname.replace(/^www\./, '')
    const existing = byDomain.get(domain)
    if (!existing || place.distanceKm < existing.distanceKm) byDomain.set(domain, place)
  }

  return [...byDomain.values()].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, config.maxSites)
}

// Reads the local places database built by scripts/import-places.ts, when there is one.
function localPlaces(lat: number, lon: number, radiusKm: number): Candidate[] | null {
  const db = openPlacesDb()
  if (!db) return null

  const latDelta = radiusKm / 111.32 // km per degree of latitude
  const lonDelta = latDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.01)
  const box = db.prepare('SELECT id, name, lat, lon, website FROM places WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?')
  return box.all(lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta) as Candidate[]
}

async function overpassPlaces(lat: number, lon: number, radiusKm: number): Promise<Candidate[]> {
  // One query matching any of the tags: asking for them separately makes Overpass 25x slower, to the point of timing out.
  const around = `around:${Math.round(radiusKm * 1000)},${lat},${lon}`
  const query = `[out:json][timeout:90];nwr(${around})["name"][~"^(${WEBSITE_TAGS.join('|')})$"~"."];out center tags;`
  const { elements } = await askOverpass(query)

  return elements.flatMap((el) => {
    const point = el.center ?? el
    const website = WEBSITE_TAGS.map((tag) => el.tags[tag]).find(Boolean)
    if (!website || point.lat === undefined || point.lon === undefined) return []
    return [{ id: `${el.type}/${el.id}`, name: el.tags.name, lat: point.lat, lon: point.lon, website }]
  })
}

// The public Overpass server replies 504 when it is busy and 429 when asked too often, so try again after a wait.
async function askOverpass(query: string): Promise<{ elements: OverpassElement[] }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(config.overpassUrl, {
      method: 'POST',
      headers: { 'User-Agent': config.userAgent },
      body: new URLSearchParams({ data: query }),
    })
    // A failed query still comes back as 200 with an explanation in "remark", so check for that too.
    const body = res.ok ? ((await res.json()) as { elements: OverpassElement[]; remark?: string }) : null
    if (body && !body.remark) return body

    const problem = body?.remark ?? `HTTP ${res.status}`
    if (attempt === config.overpassRetries) throw new Error(`Overpass request failed: ${problem}`)

    console.warn(`Overpass problem (${problem}), retrying in ${config.overpassRetryDelayMs}ms`)
    await setTimeout(config.overpassRetryDelayMs)
  }
}

let placesDb: DatabaseSync | null | undefined

function openPlacesDb(): DatabaseSync | null {
  if (placesDb === undefined) {
    placesDb = existsSync(config.placesDb) ? new DatabaseSync(config.placesDb, { readOnly: true }) : null
    console.log(placesDb ? `Using local places database: ${config.placesDb}` : 'No local places database, using the Overpass API')
  }
  return placesDb
}

// OSM website tags are hand-typed: they may lack "https://" or hold several URLs separated by ";"
export function parseWebsite(tag: string | undefined): URL | null {
  const first = tag?.split(';')[0].trim()
  if (!first) return null
  return URL.parse(/^https?:\/\//i.test(first) ? first : `https://${first}`)
}

// Haversine distance
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}
