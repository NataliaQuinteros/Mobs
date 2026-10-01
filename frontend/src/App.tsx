import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Business, SearchParams } from '../../shared/types.ts'
import { freshPostings } from './age.ts'
import { searchJobs } from './api.ts'
import { keywordFiltered } from './keyword.ts'
import BusinessDetails from './components/BusinessDetails.tsx'
import ResultsList, { type Mode, type Status } from './components/ResultsList.tsx'
import SearchForm, { type PickedLocation } from './components/SearchForm.tsx'

// The map draws vector tiles, and MapLibre is heavier than everything else on this page put together.
// Fetched on its own so the address box is ready to type in before it arrives.
const ResultsMap = lazy(() => import('./components/ResultsMap.tsx'))

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  // Where to search from, and how far around it. The form and the map both choose it, so it is held
  // here rather than inside either of them, and both are shown whatever the other one last said.
  const [location, setLocation] = useState<PickedLocation | null>(null)
  const [address, setAddress] = useState('') // the text in the search box, which a pin can overrule
  const [radiusKm, setRadiusKm] = useState(2)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [siteCount, setSiteCount] = useState(0)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(null) // null: show them whatever their age
  const [keyword, setKeyword] = useState('')
  const [mode, setMode] = useState<Mode>('postings')
  const stopSearch = useRef<(() => void) | null>(null)

  // What the filters leave is what the whole page works from — list, map and open panel alike — so a
  // business with nothing left to offer goes with them.
  const shown = useMemo(() => {
    const byAge = businesses.map((business) => ({ ...business, postings: freshPostings(business.postings, maxAgeDays) }))
    const hiring = byAge.filter((business) => business.postings.length > 0 || business.cvUrl)
    return keywordFiltered(hiring, keyword)
  }, [businesses, maxAgeDays, keyword])

  // Two searches over the same results: the backend has to read a careers page either way, so switching
  // between them is instant instead of scraping the neighbourhood twice. A business is in one or the
  // other — cvUrl is only filled in when there were no postings to find.
  const groups = {
    postings: shown.filter((business) => business.postings.length > 0),
    cv: shown.filter((business) => business.postings.length === 0),
  }
  const listed = groups[mode]

  const countPostings = (found: Business[]) => found.reduce((count, business) => count + business.postings.length, 0)
  const hiddenCount = countPostings(businesses) - countPostings(shown)
  const selected = listed.find((business) => business.id === selectedId) ?? null

  // What the map draws: the chosen spot with the radius around it, both live, before any search runs.
  const area = useMemo<SearchParams | null>(
    () => location && { lat: location.lat, lon: location.lon, radiusKm },
    [location, radiusKm],
  )

  useEffect(() => () => stopSearch.current?.(), []) // stop the stream when the page closes

  // A pin dropped or dragged on the map: nothing there names the spot, so its coordinates do, and
  // whatever address was typed is left describing somewhere else.
  const handlePinDropped = useCallback((coords: { lat: number; lon: number }) => {
    const label = `Pin dropped at (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`
    setLocation({ ...coords, label, source: 'map' })
    setAddress('')
  }, [])

  function handleSearch(params: SearchParams) {
    stopSearch.current?.()
    setStatus('loading')
    setBusinesses([])
    setSelectedId(null)
    setSiteCount(0)
    setError('')

    stopSearch.current = searchJobs(params, (event) => {
      if (event.type === 'scanning') setSiteCount(event.siteCount)
      if (event.type === 'business') setBusinesses((found) => [...found, event.business])
      if (event.type === 'done') setStatus('done')
      if (event.type === 'error') {
        setError(event.message)
        setStatus('error')
      }
    })
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <h1 className="text-3xl font-bold">Work Radar</h1>
        <p className="text-slate-500">Find jobs at businesses near you</p>
      </header>

      {/* Map first in the markup so it sits on top on a phone, and on the right on a wide screen. */}
      <div className="mt-6 flex flex-col gap-6 md:flex-row-reverse md:items-start">
        <div className="md:sticky md:top-4 md:w-80 md:shrink-0">
          <Suspense fallback={<div className="aspect-square w-full rounded-xl border border-slate-200 bg-slate-100" />}>
            <ResultsMap search={area} businesses={listed} onPickLocation={handlePinDropped} />
          </Suspense>
          {selected && <BusinessDetails key={selected.id} business={selected} onClose={() => setSelectedId(null)} />}
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <SearchForm
            loading={status === 'loading'}
            address={address}
            location={location}
            radiusKm={radiusKm}
            onAddressChange={setAddress}
            onLocationChange={setLocation}
            onRadiusChange={setRadiusKm}
            onSearch={handleSearch}
          />
          <ResultsList
            status={status}
            businesses={listed}
            mode={mode}
            counts={{ postings: groups.postings.length, cv: groups.cv.length }}
            onModeChange={setMode}
            siteCount={siteCount}
            error={error}
            selectedId={selected?.id}
            onSelect={(business) => setSelectedId(business.id)}
            maxAgeDays={maxAgeDays}
            keyword={keyword}
            hiddenCount={hiddenCount}
            onMaxAgeChange={setMaxAgeDays}
            onKeywordChange={setKeyword}
          />
        </div>
      </div>

      {/* The businesses themselves are OpenStreetMap data, so the credit belongs to the page, not only
          to the map in the corner of it. */}
      <footer className="mt-10 text-xs text-slate-400">
        Business locations and websites from{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">
          OpenStreetMap contributors
        </a>
        , licensed under{' '}
        <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noreferrer" className="hover:underline">
          ODbL
        </a>
        .
      </footer>
    </main>
  )
}
