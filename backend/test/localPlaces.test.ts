import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it, vi } from 'vitest'

// In the temp folder: the backend keeps the database open, so Windows won't let us delete it afterwards.
const dbPath = join(tmpdir(), 'mobs-local-places.test.db')
rmSync(dbPath, { force: true })

const db = new DatabaseSync(dbPath)
db.exec('CREATE TABLE places (id TEXT PRIMARY KEY, name TEXT, lat REAL, lon REAL, website TEXT)')
const add = db.prepare('INSERT INTO places VALUES (?, ?, ?, ?, ?)')
add.run('n1', 'Corner Café', 43.7384, 7.4246, 'https://cafe.example/') // same spot as the search
add.run('n2', 'Harbour Hotel', 43.7429, 7.4246, 'https://hotel.example/') // ~500 m north
add.run('n3', 'Far Away Shop', 43.9, 7.4246, 'https://shop.example/') // ~18 km north
db.close()

vi.stubEnv('PLACES_DB', dbPath)
const { findBusinesses } = await import('../src/places.ts')

describe('findBusinesses with a local database', () => {
  it('returns places inside the radius, closest first, without calling Overpass', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const found = await findBusinesses(43.7384, 7.4246, 1)

    expect(found.map((place) => place.name)).toEqual(['Corner Café', 'Harbour Hotel'])
    expect(found[1].distanceKm).toBeCloseTo(0.5, 1)
    expect(fetch).not.toHaveBeenCalled()
  })
})
