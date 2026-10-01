import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Business } from '../../../shared/types.ts'
import BusinessDetails from './BusinessDetails.tsx'

vi.mock('../api.ts', () => ({
  readPosting: async (url: string) => ({
    url,
    title: url.endsWith('qa') ? 'QA Engineer' : 'Frontend Developer',
    summary: url.endsWith('qa') ? 'You will test what we ship.' : 'You will build our web app with React.',
    location: 'Lausanne',
  }),
}))

const business: Business = {
  id: 'n1',
  name: 'Northwind',
  website: 'https://northwind.example',
  lat: 46.54,
  lon: 6.58,
  distanceKm: 0.4,
  careersUrl: 'https://northwind.example/careers',
  postings: [
    { title: 'Frontend Developer', url: 'https://northwind.example/careers/frontend' },
    { title: 'QA Engineer', url: 'https://northwind.example/careers/qa' },
  ],
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

const withDates = (postings: Business['postings']) => ({ ...business, postings })

it('slides through the open positions one card at a time', async () => {
  render(<BusinessDetails business={business} onClose={() => {}} />)

  const slides = await screen.findByRole('region', { name: 'Open positions' })
  const next = screen.getByRole('button', { name: /next position/i })
  const previous = screen.getByRole('button', { name: /previous position/i })

  // The first card is the one on show, and there is nothing before it.
  expect(screen.getByText('1 / 2')).toBeDefined()
  expect(previous.hasAttribute('disabled')).toBe(true)
  expect(slides.querySelector('ul')?.style.transform).toBe('translateX(-0%)')

  fireEvent.click(next)

  expect(screen.getByText('2 / 2')).toBeDefined()
  expect(slides.querySelector('ul')?.style.transform).toBe('translateX(-100%)')
  expect(next.hasAttribute('disabled')).toBe(true)
  expect(previous.hasAttribute('disabled')).toBe(false)

  fireEvent.click(previous)
  expect(screen.getByText('1 / 2')).toBeDefined()
})

it('says how old each advert is, and warns about the stale ones', async () => {
  const dated = withDates([
    { title: 'Frontend Developer', url: 'https://northwind.example/careers/frontend', postedAt: daysAgo(2) },
    { title: 'QA Engineer', url: 'https://northwind.example/careers/qa', postedAt: daysAgo(120) },
  ])
  render(<BusinessDetails business={dated} onClose={() => {}} />)

  expect(screen.getByText(/posted 2 days ago/)).toBeDefined()
  expect(screen.getByText(/posted 4 months ago/)).toBeDefined()
  expect(screen.getAllByText('30+ days old')).toHaveLength(1) // only the old one is flagged
})

it('says nothing about age when the site never dated the advert', () => {
  render(<BusinessDetails business={business} onClose={() => {}} />)

  expect(screen.queryByText(/posted/)).toBeNull()
  expect(screen.queryByText('30+ days old')).toBeNull()
})

it('shows each posting once it has been read', async () => {
  render(<BusinessDetails business={business} onClose={() => {}} />)

  expect(await screen.findByText(/You will build our web app/)).toBeDefined()
  expect(await screen.findByText(/You will test what we ship/)).toBeDefined()
})
