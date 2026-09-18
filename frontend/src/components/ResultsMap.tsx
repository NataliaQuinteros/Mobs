import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Business, SearchParams } from '../../../shared/types.ts'

type Props = {
  search: SearchParams | null
  businesses: Business[]
}

// OpenStreetMap map showing the search circle and every business found inside it.
export default function ResultsMap({ search, businesses }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map>(null)
  const area = useRef<L.LayerGroup>(null)
  const pins = useRef<L.LayerGroup>(null)

  useEffect(() => {
    if (!container.current) return

    const created = L.map(container.current).setView([48.5, 9], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(created)

    map.current = created
    area.current = L.layerGroup().addTo(created)
    pins.current = L.layerGroup().addTo(created)

    // Leaflet caches the box size, so tell it whenever the layout changes it.
    const resizes = new ResizeObserver(() => created.invalidateSize())
    resizes.observe(container.current)

    return () => {
      resizes.disconnect()
      created.remove() // without this a hot reload leaves a dead map on the element
      map.current = null
    }
  }, [])

  // The searched circle, redrawn only when the search changes.
  useEffect(() => {
    if (!map.current || !area.current || !search) return
    area.current.clearLayers()

    const centre: L.LatLngExpression = [search.lat, search.lon]
    const circle = L.circle(centre, { radius: search.radiusKm * 1000, color: '#4f46e5', weight: 2, fillOpacity: 0.08 })
    circle.addTo(area.current)
    L.circleMarker(centre, { radius: 5, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 1 }).addTo(area.current)

    map.current.invalidateSize() // the box may still have been 0 wide when the map was created
    map.current.fitBounds(circle.getBounds().pad(0.1))
  }, [search])

  // Businesses arrive one by one while the search runs.
  useEffect(() => {
    if (!pins.current) return
    pins.current.clearLayers()

    for (const business of businesses) {
      L.circleMarker([business.lat, business.lon], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: business.postings.length ? '#16a34a' : '#f59e0b', // green: jobs read, amber: careers page only
        fillOpacity: 1,
      })
        .bindTooltip(`${business.name}${business.postings.length ? ` · ${business.postings.length} jobs` : ''}`)
        .addTo(pins.current)
    }
  }, [businesses])

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <div ref={container} className="aspect-square w-full bg-slate-100" />
      {!search && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-slate-500">
          Your search area appears here
        </p>
      )}
    </div>
  )
}
