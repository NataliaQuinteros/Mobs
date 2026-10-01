import { fireEvent, render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import ResultsMap from './ResultsMap.tsx'

const business = {
  id: 'n1',
  name: 'Northwind',
  website: 'https://northwind.example',
  lat: 46.54,
  lon: 6.58,
  distanceKm: 0.4,
  careersUrl: 'https://northwind.example/careers',
  postings: [],
}

const search = { lat: 46.537, lon: 6.5776, radiusKm: 2 }

it('draws the search circle and a pin per business', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

  const { container } = render(<ResultsMap search={search} businesses={[business]} />)

  expect(container.querySelector('.leaflet-container')).not.toBeNull()
  // Leaflet draws vector layers as SVG paths: one circle for the area, one dot per business. The
  // centre is a marker of its own so that it can be picked up and moved.
  expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(2)
  expect(container.querySelector('.leaflet-marker-pane .leaflet-marker-icon')).not.toBeNull()
  expect(errors).not.toHaveBeenCalled()
})

it('leaves the centre pin where it is when nothing may be picked on the map', () => {
  const { container } = render(<ResultsMap search={search} businesses={[]} />)

  expect(container.querySelector('.leaflet-marker-draggable')).toBeNull()
  fireEvent.click(container.querySelector('.leaflet-container')!) // no handler, nothing to move
})

it('clicking the map picks the spot as the location', () => {
  const picked = vi.fn()

  const { container } = render(<ResultsMap search={null} businesses={[]} onPickLocation={picked} />)

  fireEvent.click(container.querySelector('.leaflet-container')!)

  expect(picked).toHaveBeenCalledTimes(1)
  const [coords] = picked.mock.calls[0]
  expect(Number.isFinite(coords.lat) && Number.isFinite(coords.lon)).toBe(true)
})

it('offers the centre pin for dragging once there is an area', () => {
  const { container } = render(<ResultsMap search={search} businesses={[]} onPickLocation={vi.fn()} />)

  expect(container.querySelector('.leaflet-marker-draggable')).not.toBeNull()
})

it('clicking a business opens it without moving the search', () => {
  const picked = vi.fn()

  const { container } = render(<ResultsMap search={search} businesses={[business]} onPickLocation={picked} />)
  fireEvent.click(container.querySelector('path[fill="#f59e0b"]')!) // the business, not the area around it

  expect(picked).not.toHaveBeenCalled()
})
