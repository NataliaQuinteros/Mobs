import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('OVERPASS_RETRY_DELAY_MS', '1') // no real waiting in tests
vi.stubEnv('PLACES_DB', 'test/no-local-database.db') // these tests cover the Overpass path
const { findBusinesses } = await import('../src/places.ts')

const busy = async () => new Response('', { status: 504 })
const places = (elements: unknown[]) => async () => Response.json({ elements })

const cafe = { type: 'node', id: 1, lat: 41.4036, lon: 2.192, tags: { name: 'Café', website: 'acme.example' } }

describe('findBusinesses', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('retries when the Overpass server is busy', async () => {
    vi.mocked(fetch).mockImplementationOnce(busy).mockImplementationOnce(places([cafe]))

    const found = await findBusinesses(41.4036, 2.192, 1)
    expect(found).toEqual([{ id: 'node/1', name: 'Café', website: 'https://acme.example/', lat: 41.4036, lon: 2.192, distanceKm: 0 }])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('accepts the other website tags mappers use', async () => {
    const shop = { type: 'node', id: 2, lat: 41.4036, lon: 2.192, tags: { name: 'Lidl', 'brand:website': 'www.lidl.es' } }
    vi.mocked(fetch).mockImplementationOnce(places([{ ...cafe, tags: { name: 'Café', 'contact:website': 'acme.example' } }, shop]))

    const found = await findBusinesses(41.4036, 2.192, 1)
    expect(found.map((place) => place.website)).toEqual(['https://acme.example/', 'https://www.lidl.es/'])
  })

  it('retries when a 200 response carries an error remark', async () => {
    const timedOut = async () => Response.json({ elements: [], remark: 'runtime error: Query timed out' })
    vi.mocked(fetch).mockImplementationOnce(timedOut).mockImplementationOnce(places([cafe]))

    const found = await findBusinesses(41.4036, 2.192, 1)
    expect(found).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up after the configured number of retries', async () => {
    vi.mocked(fetch).mockImplementation(busy)

    await expect(findBusinesses(41.4036, 2.192, 1)).rejects.toThrow('Overpass request failed: HTTP 504')
    expect(fetch).toHaveBeenCalledTimes(3) // first try + 2 retries
  })
})
