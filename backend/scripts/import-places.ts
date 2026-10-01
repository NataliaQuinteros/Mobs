// Loads the export made by build-places.sh into the SQLite database the backend reads.
// Usage: npx tsx scripts/import-places.ts [path to places.geojsonseq]
import { createReadStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { config } from '../src/config.ts'
import { parseWebsite, WEBSITE_TAGS } from '../src/places.ts'

const source = process.argv[2] ?? 'C:/osm-data/places.geojsonseq'

await rm(config.placesDb, { force: true })
const db = new DatabaseSync(config.placesDb)
db.exec(`
  PRAGMA journal_mode = OFF;
  CREATE TABLE places (id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, website TEXT NOT NULL);
`)
const insert = db.prepare('INSERT OR IGNORE INTO places (id, name, lat, lon, website) VALUES (?, ?, ?, ?, ?)')

let read = 0
let kept = 0
db.exec('BEGIN')

// Records are separated by 0x1e (RFC 8142) and may themselves contain newlines, so lines are not records.
let pending = ''
for await (const chunk of createReadStream(source, { encoding: 'utf8' })) {
  const records = (pending + chunk).split('\x1e')
  pending = records.pop() ?? ''
  for (const record of records) addPlace(record)
}
addPlace(pending)

db.exec('COMMIT')
console.log('Indexing…')
db.exec('CREATE INDEX places_lat_lon ON places (lat, lon)')
db.close()
console.log(`Done: ${kept.toLocaleString()} places in ${config.placesDb}`)

function addPlace(record: string) {
  if (!record.trim()) return
  read++

  let feature
  try {
    feature = JSON.parse(record)
  } catch {
    return // a record we can't read is not worth stopping an 11 GB import for
  }

  const tags = feature.properties ?? {}
  const website = parseWebsite(WEBSITE_TAGS.map((tag: string) => tags[tag]).find(Boolean))
  const point = centreOf(feature.geometry)
  if (!tags.name || !website || !point) return

  insert.run(feature.id ?? `${read}`, tags.name, point[1], point[0], website.href)
  kept++

  if (read % 1_000_000 === 0) {
    db.exec('COMMIT')
    db.exec('BEGIN')
    console.log(`${read.toLocaleString()} read, ${kept.toLocaleString()} kept`)
  }
}

// One representative coordinate per place: a point as-is, anything else averaged.
function centreOf(geometry: { type: string; coordinates: unknown } | undefined): [number, number] | null {
  if (!geometry) return null
  if (geometry.type === 'Point') return geometry.coordinates as [number, number]

  let points = geometry.coordinates as number[][]
  while (Array.isArray(points[0]?.[0])) points = points[0] as unknown as number[][] // outer ring of a (multi)polygon
  if (!points.length) return null

  const sum = points.reduce((total, [x, y]) => [total[0] + x, total[1] + y], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}
