import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useRef } from 'react'
import type { Business, SearchParams } from '../../../shared/types.ts'
import { tiles } from '../tiles.ts'

// Drawing vector tiles needs WebGL, so the map itself stays Leaflet: the circle and the pins are its
// own SVG, and they survive a browser that has none. Where the tiles come from is tiles.ts.

// Vector tiles are drawn on a canvas. Without one the map keeps its circle and pins on a blank
// background, which is what a test environment and a browser with WebGL turned off both get.
function hasWebGL(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

// The centre of the search, drawn inline rather than as Leaflet's default marker: no image files to
// ship, and it is a real marker, so it can be picked up and dragged.
const pinIcon = L.divIcon({
  className: '', // the class Leaflet gives a div icon by default paints a white box behind it
  html: `<svg viewBox="0 0 26 34" width="26" height="34" style="display:block;cursor:grab">
    <path d="M13 1C6.9 1 2 5.9 2 12c0 8 11 21 11 21s11-13 11-21c0-6.1-4.9-11-11-11z" fill="#4f46e5" stroke="#fff" stroke-width="2" />
    <circle cx="13" cy="12" r="4" fill="#fff" />
  </svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 33], // the tip of the pin is the spot it stands for
})

type Props = {
  search: SearchParams | null
  businesses: Business[]
  onPickLocation?: (coords: { lat: number; lon: number }) => void // set when the map may choose the location
}

// OpenStreetMap map showing the search circle and every business found inside it.
export default function ResultsMap({ search, businesses, onPickLocation }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map>(null)
  const area = useRef<L.LayerGroup>(null)
  const pins = useRef<L.LayerGroup>(null)
  const fitted = useRef(false) // whether the map has ever been moved to a search area
  const fromMap = useRef(false) // the pending search came from a click or a drag on the map itself

  // The map is built once and outlives any one render, so the handler it calls is read from a ref.
  const pick = useRef(onPickLocation)
  useEffect(() => {
    pick.current = onPickLocation
  }, [onPickLocation])

  const canPick = Boolean(onPickLocation)

  const dropPin = useCallback((at: L.LatLng) => {
    if (!pick.current) return
    fromMap.current = true
    pick.current({ lat: at.lat, lon: at.lng })
  }, [])

  useEffect(() => {
    if (!container.current) return

    const created = L.map(container.current).setView([48.5, 9], 4)
    // WebGL is asked about before the layer is added, not caught afterwards: a MapLibre layer that
    // failed to start throws again when Leaflet takes it off the map.
    // The layer credits the tiles itself once its style loads, so the credit is only added by hand
    // when there is no layer to do it — otherwise it shows up twice.
    if (hasWebGL()) maplibreGL({ style: tiles.style }).addTo(created)
    else created.attributionControl.addAttribution(tiles.attribution)

    // Anywhere on the map is a place to search from. A business pin keeps its own click (see below),
    // so opening one never moves the search out from under it.
    created.on('click', (e: L.LeafletMouseEvent) => dropPin(e.latlng))

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
  }, [dropPin])

  // The searched circle and the pin at its centre, redrawn only when the search changes.
  useEffect(() => {
    if (!map.current || !area.current || !search) return
    area.current.clearLayers()

    const centre: L.LatLngExpression = [search.lat, search.lon]
    const circle = L.circle(centre, { radius: search.radiusKm * 1000, color: '#4f46e5', weight: 2, fillOpacity: 0.08 })
    circle.addTo(area.current)

    const pin = L.marker(centre, {
      icon: pinIcon,
      draggable: canPick,
      keyboard: false, // focusable but not movable by keyboard would be a promise it cannot keep
      title: canPick ? 'Drag to move the search area' : undefined,
    })
    pin.on('drag', () => circle.setLatLng(pin.getLatLng())) // the area comes along while the pin moves
    pin.on('dragend', () => dropPin(pin.getLatLng()))
    pin.addTo(area.current)

    map.current.invalidateSize() // the box may still have been 0 wide when the map was created

    // Fitting the circle would pull the map away from wherever the pin was just put, so a location
    // chosen on the map keeps the view it was chosen in. The first one still has to be found at all.
    const keepView = fromMap.current && fitted.current
    fromMap.current = false
    if (keepView) return

    map.current.fitBounds(circle.getBounds().pad(0.1))
    fitted.current = true
  }, [search, canPick, dropPin])

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
        bubblingMouseEvents: false, // a click here is about this business, not about where to search
      })
        .bindTooltip(`${business.name}${business.postings.length ? ` · ${business.postings.length} jobs` : ''}`)
        .addTo(pins.current)
    }
  }, [businesses])

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <div
        ref={container}
        className="aspect-square w-full bg-slate-100"
        style={canPick ? { cursor: 'crosshair' } : undefined}
      />
      {canPick ? (
        <p className="pointer-events-none absolute inset-x-0 top-3 z-1000 text-center text-sm">
          <span className="rounded-full bg-white/85 px-3 py-1 text-slate-600 shadow-sm">
            {search ? 'Click the map or drag the pin to move the search' : 'Click the map to drop a pin'}
          </span>
        </p>
      ) : (
        !search && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-slate-500">
            Your search area appears here
          </p>
        )
      )}
    </div>
  )
}
