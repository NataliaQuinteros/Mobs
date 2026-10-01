import type { Business } from '../../../shared/types.ts'
import { ageInDays, describeAge, STALE_DAYS } from '../age.ts'

const MAX_SHOWN = 5

type Props = {
  business: Business
  selected: boolean
  onSelect: () => void
}

export default function BusinessCard({ business, selected, onSelect }: Props) {
  const { name, website, distanceKm, careersUrl, postings, cvUrl } = business

  return (
    <article
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{name}</h2>
        <span className="text-sm whitespace-nowrap text-slate-500">{distanceKm.toFixed(1)} km</span>
      </header>

      <p className="mt-1 text-sm">
        {postings.length > 0 ? (
          <span className="text-green-700">
            {postings.length} open {postings.length === 1 ? 'position' : 'positions'}
          </span>
        ) : (
          <span className="text-amber-700">Accepts CVs</span>
        )}
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-2 text-slate-400 hover:underline"
        >
          {new URL(website).hostname.replace(/^www\./, '')}
        </a>
      </p>

      {postings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {postings.slice(0, MAX_SHOWN).map((job) => {
            const days = ageInDays(job.postedAt)
            return (
              <li key={job.url + job.title} className="truncate text-sm text-slate-600">
                {job.title}
                {job.location && <span className="text-slate-400"> · {job.location}</span>}
                {days !== undefined && (
                  <span className={days >= STALE_DAYS ? 'text-amber-600' : 'text-slate-400'}> · {describeAge(days)}</span>
                )}
              </li>
            )
          })}
          {postings.length > MAX_SHOWN && <li className="text-sm text-slate-400">and {postings.length - MAX_SHOWN} more…</li>}
        </ul>
      )}

      {postings.length === 0 && cvUrl && (
        <a
          href={cvUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
        >
          {cvUrl.startsWith('mailto:') ? `Send your CV to ${cvUrl.slice(7)}` : 'Open the application form'} →
        </a>
      )}

      <a
        href={careersUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-2 block text-xs text-slate-400 hover:underline"
      >
        careers page
      </a>
    </article>
  )
}
