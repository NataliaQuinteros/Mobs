import pLimit from 'p-limit'
import type { SearchEvent, SearchParams } from '../../shared/types.ts'
import { findCareersPage } from './careersPage.ts'
import { findBusinesses } from './places.ts'
import { extractPostings } from './postings.ts'

const limit = pLimit(5) // websites scraped at the same time

// Reports each business as soon as its careers page is found, instead of waiting for all of them.
export async function search(
  { lat, lon, radiusKm }: SearchParams,
  onEvent: (event: SearchEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const places = await findBusinesses(lat, lon, radiusKm)
  onEvent({ type: 'scanning', siteCount: places.length })

  await Promise.all(
    places.map((place) =>
      limit(async () => {
        if (signal.aborted) return

        const page = await findCareersPage(place.website)
        if (!page) return

        const postings = await extractPostings(page).catch(() => [])
        if (!signal.aborted) onEvent({ type: 'business', business: { ...place, careersUrl: page.url, postings } })
      }),
    ),
  )
}
