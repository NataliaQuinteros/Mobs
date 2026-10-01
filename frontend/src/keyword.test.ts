import { expect, it } from 'vitest'
import type { Business } from '../../shared/types.ts'
import { keywordFiltered } from './keyword.ts'

const business = (name: string, postings: Business['postings']): Business => ({
  id: name,
  name,
  website: `https://${name}.example`,
  lat: 46.54,
  lon: 6.58,
  distanceKm: 0.4,
  careersUrl: `https://${name}.example/careers`,
  postings,
})

const businesses = [
  business('Galenica', [
    { title: 'Pharma-Assistentin (w/m/d)', url: 'https://galenica.example/1', location: 'Zürich' },
    { title: 'Lagermitarbeiter', url: 'https://galenica.example/2', location: 'Bern' },
  ]),
  business('Café Central', [{ title: 'Barista 80%', url: 'https://cafe.example/1' }]),
]

it('keeps the postings whose words match, wherever they sit', () => {
  const [found, ...rest] = keywordFiltered(businesses, 'pharma')

  expect(rest).toHaveLength(0)
  expect(found.postings.map((posting) => posting.title)).toEqual(['Pharma-Assistentin (w/m/d)'])
})

it('ignores accents and the order of the words', () => {
  expect(keywordFiltered(businesses, 'zurich')[0].postings).toHaveLength(1) // matches Zürich
  expect(keywordFiltered(businesses, 'bern lager')[0].postings.map((p) => p.title)).toEqual(['Lagermitarbeiter'])
})

it('keeps everything an employer has open when their own name matches', () => {
  expect(keywordFiltered(businesses, 'galenica')[0].postings).toHaveLength(2)
})

it('drops a business with nothing left, and leaves an empty filter alone', () => {
  expect(keywordFiltered(businesses, 'welder')).toEqual([])
  expect(keywordFiltered(businesses, '   ')).toEqual(businesses)
})
