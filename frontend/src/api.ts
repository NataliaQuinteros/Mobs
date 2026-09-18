import type { SearchEvent, SearchParams } from '../../shared/types.ts'
import { mockBusinesses } from './mockData.ts'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

export async function geocode(address: string): Promise<{ lat: number; lon: number; displayName: string }> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not look up that address')

  const [place] = await res.json()
  if (!place) throw new Error('Address not found')
  return { lat: Number(place.lat), lon: Number(place.lon), displayName: place.display_name }
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

function mockSearch(onEvent: (event: SearchEvent) => void): () => void {
  onEvent({ type: 'scanning', siteCount: 12 })

  const timers = mockBusinesses.map((business, i) =>
    setTimeout(() => onEvent({ type: 'business', business }), 800 * (i + 1)),
  )
  timers.push(setTimeout(() => onEvent({ type: 'done' }), 800 * (mockBusinesses.length + 1)))

  return () => timers.forEach(clearTimeout)
}
