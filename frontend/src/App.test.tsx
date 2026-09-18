import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { SearchEvent, SearchParams } from '../../shared/types.ts'
import App from './App.tsx'

const business = {
  id: 'n1',
  name: 'Northwind',
  website: 'https://northwind.example',
  lat: 46.54,
  lon: 6.58,
  distanceKm: 0.4,
  careersUrl: 'https://northwind.example/careers',
  postings: [{ title: 'Frontend Developer', url: 'https://northwind.example/careers/frontend' }],
}

vi.mock('./api.ts', () => ({
  geocode: async () => ({ lat: 46.537, lon: 6.5776, displayName: 'Écublens' }),
  searchJobs: (_params: SearchParams, onEvent: (event: SearchEvent) => void) => {
    onEvent({ type: 'scanning', siteCount: 1 })
    onEvent({ type: 'business', business })
    onEvent({ type: 'done' })
    return () => {}
  },
}))

it('shows the area on the map as soon as an address is picked, before searching', async () => {
  const { container } = render(<App />)

  const field = screen.getByPlaceholderText(/address/i)
  fireEvent.change(field, { target: { value: 'Écublens' } })
  fireEvent.blur(field)

  // circle + centre dot, and no business pins yet
  await waitFor(() => expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(2))
  expect(screen.queryByText('Northwind')).toBeNull()
})

it('searching draws the area on the map and lists the business', async () => {
  const { container } = render(<App />)
  expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(0)

  fireEvent.change(screen.getByPlaceholderText(/address/i), { target: { value: 'Écublens' } })
  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))

  await waitFor(() => expect(screen.getByText('Northwind')).toBeDefined())
  // circle + centre dot + one business pin
  expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(3)
})
