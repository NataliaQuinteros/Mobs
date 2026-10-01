import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  postings: [
    { title: 'Frontend Developer', url: 'https://northwind.example/careers/frontend' }, // the site gave no date
    { title: 'Night Porter', url: 'https://northwind.example/careers/porter', postedAt: '2025-01-05' },
  ],
}

// No postings anywhere on their site, but a form to send a CV to: the other search.
const cvOnly = {
  id: 'n2',
  name: 'Café Central',
  website: 'https://cafecentral.example',
  lat: 46.53,
  lon: 6.57,
  distanceKm: 0.9,
  careersUrl: 'https://cafecentral.example/work-with-us',
  postings: [],
  cvUrl: 'mailto:jobs@cafecentral.example',
}

vi.mock('./api.ts', () => ({
  geocode: async () => ({ lat: 46.537, lon: 6.5776, displayName: 'Écublens' }),
  suggestPlaces: async () => [{ lat: 46.537, lon: 6.5776, displayName: 'Écublens, Vaud, Switzerland' }],
  readPosting: async (url: string) => ({
    url,
    title: url.endsWith('porter') ? 'Night Porter' : 'Frontend Developer',
    summary: url.endsWith('porter') ? 'You will keep the hotel running at night.' : 'You will build our web app with React.',
    location: 'Lausanne',
    employmentType: 'FULL_TIME',
  }),
  searchJobs: (_params: SearchParams, onEvent: (event: SearchEvent) => void) => {
    onEvent({ type: 'scanning', siteCount: 1 })
    onEvent({ type: 'business', business })
    onEvent({ type: 'business', business: cvOnly })
    onEvent({ type: 'done' })
    return () => {}
  },
}))

async function pickAddress() {
  fireEvent.change(screen.getByPlaceholderText(/address/i), { target: { value: 'Écublens' } })
  const suggestion = await screen.findByText(/Écublens, Vaud/)
  fireEvent.mouseDown(suggestion)
}

it('suggests addresses and shows the area on the map before searching', async () => {
  const { container } = render(<App />)

  await pickAddress()

  // the searched circle, with its pin, and no business pins yet
  await waitFor(() => expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(1))
  expect(container.querySelector('.leaflet-marker-pane .leaflet-marker-icon')).not.toBeNull()
  expect(screen.queryByText('Northwind')).toBeNull()
})

it('dropping a pin on the map searches from there instead of the address', async () => {
  const { container } = render(<App />)
  await pickAddress()
  await waitFor(() => expect(container.querySelector('.leaflet-container')).not.toBeNull())

  fireEvent.click(container.querySelector('.leaflet-container')!)

  // The pin is now the location: it says where it is, and the address it replaced is gone from the box.
  expect(await screen.findByText(/Pin dropped at/)).toBeDefined()
  expect((screen.getByPlaceholderText(/address/i) as HTMLInputElement).value).toBe('')

  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))
  expect(await screen.findByText('Northwind')).toBeDefined()
})

it('searching lists the business and pins it on the map', async () => {
  const { container } = render(<App />)
  await pickAddress()

  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))

  await waitFor(() => expect(screen.getByText('Northwind')).toBeDefined())
  expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(2) // circle and business
})

it('opening a business shows a summary of each posting beside the list', async () => {
  render(<App />)
  await pickAddress()
  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))
  fireEvent.click(await screen.findByText('Northwind'))

  const panel = within(await screen.findByRole('complementary'))
  expect(await panel.findByText(/You will build our web app/)).toBeDefined()
  expect(panel.getByText(/2 open positions · 0.4 km/)).toBeDefined()
})

it('keeps the two searches apart: positions open, and businesses that only take a CV', async () => {
  render(<App />)
  await pickAddress()
  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))

  // Active job postings is where a search starts, so a business with nothing open is not in the way.
  await waitFor(() => expect(screen.getByText('Northwind')).toBeDefined())
  expect(screen.queryByText('Café Central')).toBeNull()
  expect(screen.getByText(/1 businesses hiring · 2 postings/)).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: /receive cvs/i }))

  expect(screen.getByText('Café Central')).toBeDefined()
  expect(screen.queryByText('Northwind')).toBeNull()
  expect(screen.getByText(/1 businesses taking open applications/)).toBeDefined()
  expect(screen.queryByLabelText(/posted/i)).toBeNull() // nothing to date over here
})

it('hides postings older than the chosen age, and keeps the undated ones', async () => {
  render(<App />)
  await pickAddress()
  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))

  await waitFor(() => expect(screen.getByText('Night Porter')).toBeDefined())

  fireEvent.change(screen.getByLabelText(/posted/i), { target: { value: '30' } })

  expect(screen.queryByText('Night Porter')).toBeNull() // dated 2025, so we know it is old
  expect(screen.getByText('Frontend Developer')).toBeDefined() // no date, so its age is unknown
  expect(screen.getByText(/1 posting hidden by the filters/)).toBeDefined()
})

it('filters the postings by keyword, matching the business name as a whole', async () => {
  render(<App />)
  await pickAddress()
  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))

  const filter = await screen.findByLabelText(/filter by keyword/i)

  fireEvent.change(filter, { target: { value: 'porter' } })
  expect(screen.getByText('Night Porter')).toBeDefined()
  expect(screen.queryByText('Frontend Developer')).toBeNull()

  // The employer's own name keeps everything they have open.
  fireEvent.change(filter, { target: { value: 'northwind' } })
  expect(screen.getByText('Night Porter')).toBeDefined()
  expect(screen.getByText('Frontend Developer')).toBeDefined()

  fireEvent.change(filter, { target: { value: 'welder' } })
  expect(screen.queryByText('Northwind')).toBeNull()
  expect(screen.getByText(/Nothing matches these filters/)).toBeDefined()
})
