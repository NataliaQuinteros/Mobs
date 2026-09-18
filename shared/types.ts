// API contract shared by frontend and backend.

export type JobPosting = {
  title: string
  url: string
  location?: string
}

export type Business = {
  id: string
  name: string
  website: string
  lat: number
  lon: number
  distanceKm: number
  careersUrl: string
  postings: JobPosting[] // empty when the careers page couldn't be parsed
}

export type SearchParams = {
  lat: number
  lon: number
  radiusKm: number
}

// GET /api/search?lat=&lon=&radiusKm= streams these as server-sent events,
// so the page can show each business the moment its careers page is found.
export type SearchEvent =
  | { type: 'scanning'; siteCount: number } // how many websites will be checked
  | { type: 'business'; business: Business }
  | { type: 'done' }
  | { type: 'error'; message: string }
