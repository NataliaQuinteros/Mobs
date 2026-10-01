// API contract shared by frontend and backend.

export type JobPosting = {
  title: string
  url: string
  location?: string
  postedAt?: string // when the advert went up (yyyy-mm-dd), when the site says; undated postings are of unknown age
}

export type Business = {
  id: string
  name: string
  website: string
  lat: number
  lon: number
  distanceKm: number
  careersUrl: string
  postings: JobPosting[] // open positions we could read
  cvUrl?: string // where to send a CV when there is a form or an address for open applications
}

// Details of one posting, read from its own page when a business card is opened.
export type PostingDetails = {
  url: string
  title: string
  summary: string
  location?: string
  employmentType?: string
  postedAt?: string
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
