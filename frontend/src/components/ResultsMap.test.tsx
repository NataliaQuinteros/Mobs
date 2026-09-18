import { render } from '@testing-library/react'
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

it('draws the search circle and a pin per business', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

  const { container } = render(<ResultsMap search={{ lat: 46.537, lon: 6.5776, radiusKm: 2 }} businesses={[business]} />)

  expect(container.querySelector('.leaflet-container')).not.toBeNull()
  // Leaflet draws vector layers as SVG paths: one circle for the area, one dot for the centre, one per business.
  expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(3)
  expect(errors).not.toHaveBeenCalled()
})
