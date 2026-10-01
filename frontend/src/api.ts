import type { PostingDetails, SearchEvent, SearchParams } from '../../shared/types.ts'
import { mockBusinesses } from './mockData.ts'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

export type Place = { lat: number; lon: number; displayName: string }

export async function geocode(address: string): Promise<Place> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not look up that address')

  const [place] = await res.json()
  if (!place) throw new Error('Address not found')
  return { lat: Number(place.lat), lon: Number(place.lon), displayName: place.display_name }
}

// Photon is OpenStreetMap data too, but unlike Nominatim it is meant to be called while you type.
export async function suggestPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const res = await fetch(`https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(query)}`, { signal })
  if (!res.ok) throw new Error('Could not look up that address')

  const { features } = await res.json()
  return (features ?? []).map((feature: PhotonFeature) => ({
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
    displayName: describe(feature.properties),
  }))
}

type PhotonProperties = { name?: string; street?: string; housenumber?: string; city?: string; state?: string; country?: string }
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: PhotonProperties }

function describe({ name, street, housenumber, city, state, country }: PhotonProperties): string {
  const street_ = street && [street, housenumber].filter(Boolean).join(' ')
  return [name, street_, city, state, country].filter(Boolean).join(', ')
}

// Results arrive one by one. Returns a function that stops the search.
export function searchJobs({ lat, lon, radiusKm }: SearchParams, onEvent: (event: SearchEvent) => void): () => void {
  if (useMocks) return mockSearch(onEvent)

  const stream = new EventSource(`/api/search?lat=${lat}&lon=${lon}&radiusKm=${radiusKm}`)

  stream.onmessage = (message) => {
    const event: SearchEvent = JSON.parse(message.data)
    if (event.type === 'done' || event.type === 'error') stream.close()
    onEvent(event)
  }
  stream.onerror = () => {
    stream.close()
    onEvent({ type: 'error', message: 'Lost the connection to the server. Is the backend running?' })
  }

  return () => stream.close()
}

export async function readPosting(url: string, signal: AbortSignal): Promise<PostingDetails> {
  const res = await fetch(`/api/posting?url=${encodeURIComponent(url)}`, { signal })
  if (!res.ok) throw new Error('Could not open that job posting')
  return res.json()
}

function mockSearch(onEvent: (event: SearchEvent) => void): () => void {
  onEvent({ type: 'scanning', siteCount: 12 })

  const timers = mockBusinesses.map((business, i) =>
    setTimeout(() => onEvent({ type: 'business', business }), 800 * (i + 1)),
  )
  timers.push(setTimeout(() => onEvent({ type: 'done' }), 800 * (mockBusinesses.length + 1)))

  return () => timers.forEach(clearTimeout)
}
