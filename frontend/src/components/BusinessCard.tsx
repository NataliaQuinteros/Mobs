import type { Business } from '../../../shared/types.ts'

const MAX_SHOWN = 10

export default function BusinessCard({ business }: { business: Business }) {
  const { name, website, distanceKm, careersUrl, postings } = business

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          <a href={website} target="_blank" rel="noreferrer" className="hover:underline">
            {name}
          </a>
        </h2>
        <span className="text-sm whitespace-nowrap text-slate-500">{distanceKm.toFixed(1)} km</span>
      </header>

      {postings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {postings.slice(0, MAX_SHOWN).map((job) => (
            <li key={job.url + job.title}>
              <a href={job.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                {job.title}
              </a>
              {job.location && <span className="text-sm text-slate-500"> · {job.location}</span>}
            </li>
          ))}
        </ul>
      )}

      {(postings.length === 0 || postings.length > MAX_SHOWN) && (
        <a href={careersUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-indigo-600 hover:underline">
          {postings.length > MAX_SHOWN ? `View all ${postings.length} jobs →` : 'View careers page →'}
        </a>
      )}
    </article>
  )
}
