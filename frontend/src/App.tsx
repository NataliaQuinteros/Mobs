import { useCallback, useEffect, useRef, useState } from 'react'
import type { Business, SearchParams } from '../../shared/types.ts'
import { searchJobs } from './api.ts'
import ResultsList, { type Status } from './components/ResultsList.tsx'
import ResultsMap from './components/ResultsMap.tsx'
import SearchForm from './components/SearchForm.tsx'

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [area, setArea] = useState<SearchParams | null>(null) // what the map shows: picked location + radius
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [siteCount, setSiteCount] = useState(0)
  const [error, setError] = useState('')
  const stopSearch = useRef<(() => void) | null>(null)

  useEffect(() => () => stopSearch.current?.(), []) // stop the stream when the page closes

  const handleLocationPicked = useCallback((params: SearchParams | null) => setArea(params), [])

  function handleSearch(params: SearchParams) {
    stopSearch.current?.()
    setStatus('loading')
    setArea(params)
    setBusinesses([])
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
        <h1 className="text-3xl font-bold">Mobs</h1>
        <p className="text-slate-500">Find jobs at businesses near you</p>
      </header>

      {/* Map first in the markup so it sits on top on a phone, and on the right on a wide screen. */}
      <div className="mt-6 flex flex-col gap-6 md:flex-row-reverse md:items-start">
        <div className="md:sticky md:top-4 md:w-80 md:shrink-0">
          <ResultsMap search={area} businesses={businesses} />
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <SearchForm loading={status === 'loading'} onSearch={handleSearch} onLocationPicked={handleLocationPicked} />
          <ResultsList status={status} businesses={businesses} siteCount={siteCount} error={error} />
        </div>
      </div>
    </main>
  )
}
