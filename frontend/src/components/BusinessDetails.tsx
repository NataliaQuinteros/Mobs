import { useEffect, useState } from 'react'
import type { Business, PostingDetails } from '../../../shared/types.ts'
import { readPosting } from '../api.ts'
import PostingSlides from './PostingSlides.tsx'

const MAX_READ = 8 // opening every posting of a 1000-job board would be rude and slow

// Panel beside the list: what this business has open, with a summary of each posting.
export default function BusinessDetails({ business, onClose }: { business: Business; onClose: () => void }) {
  const [details, setDetails] = useState<Record<string, PostingDetails | 'failed'>>({})
  const shown = business.postings.slice(0, MAX_READ)

  // One posting at a time, so a business with several doesn't get hammered: each one read leaves the
  // next unread, which runs this again. A posting the filters bring back later is picked up the same
  // way, and one already read is never fetched twice.
  const urls = shown.map((posting) => posting.url)

  useEffect(() => {
    const next = urls.find((url) => !(url in details))
    if (!next) return

    const stop = new AbortController()
    void (async () => {
      try {
        const read = await readPosting(next, stop.signal)
        setDetails((all) => ({ ...all, [next]: read }))
      } catch {
        if (!stop.signal.aborted) setDetails((all) => ({ ...all, [next]: 'failed' }))
      }
    })()

    return () => stop.abort()
    // App gives this component a key per business, so it starts empty when another one is opened.
  }, [urls.join(' '), details]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{business.name}</h2>
          <p className="text-sm text-slate-500">
            {business.postings.length > 0
              ? `${business.postings.length} open ${business.postings.length === 1 ? 'position' : 'positions'} · ${business.distanceKm.toFixed(1)} km`
              : `Accepts CVs · ${business.distanceKm.toFixed(1)} km`}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded px-2 text-slate-400 hover:bg-slate-100">
          ✕
        </button>
      </header>

      {business.postings.length === 0 && business.cvUrl && (
        <p className="mt-3 text-sm">
          No listed positions, but they take applications:{' '}
          <a href={business.cvUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            {business.cvUrl.startsWith('mailto:') ? business.cvUrl.slice(7) : 'open the form'}
          </a>
        </p>
      )}

      {shown.length > 0 && <PostingSlides postings={shown} details={details} />}

      {business.postings.length > MAX_READ && (
        <a href={business.careersUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
          View all {business.postings.length} on their careers page →
        </a>
      )}
    </aside>
  )
}
