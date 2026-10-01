import type { Business } from '../../../shared/types.ts'
import { AGE_FILTERS } from '../age.ts'
import BusinessCard from './BusinessCard.tsx'

export type Status = 'idle' | 'loading' | 'done' | 'error'

// The two searches: businesses with positions open, and businesses that only take a CV.
export type Mode = 'postings' | 'cv'

const MODES: { value: Mode; label: string }[] = [
  { value: 'postings', label: 'Active job postings' },
  { value: 'cv', label: 'Receive CVs' },
]

type Props = {
  status: Status
  businesses: Business[] // already filtered, so the counts below are what the page shows
  siteCount: number
  error: string
  selectedId?: string
  onSelect: (business: Business) => void
  mode: Mode
  counts: Record<Mode, number>
  maxAgeDays: number | null
  keyword: string
  hiddenCount: number
  onModeChange: (mode: Mode) => void
  onMaxAgeChange: (days: number | null) => void
  onKeywordChange: (keyword: string) => void
}

export default function ResultsList({
  status,
  businesses,
  siteCount,
  error,
  selectedId,
  onSelect,
  mode,
  counts,
  maxAgeDays,
  keyword,
  hiddenCount,
  onModeChange,
  onMaxAgeChange,
  onKeywordChange,
}: Props) {
  if (status === 'idle') return null
  if (status === 'error') return <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>

  // Businesses with open positions first, then by distance.
  const sorted = [...businesses].sort(
    (a, b) => Number(b.postings.length > 0) - Number(a.postings.length > 0) || a.distanceKm - b.distanceKm,
  )
  const totalPostings = sorted.reduce((sum, business) => sum + business.postings.length, 0)

  return (
    <section className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            aria-pressed={mode === value}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
              mode === value ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label} <span className="text-slate-400">{counts[value]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          aria-label="Filter by keyword"
          placeholder="Filter by word: pharma, verkauf, 80%…"
          className="min-w-40 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
        />

        {/* Nothing to date in the other search: those businesses have no postings, only a way to apply. */}
        {mode === 'postings' && (
          <label className="text-sm whitespace-nowrap text-slate-500">
            Posted{' '}
            <select
              value={maxAgeDays ?? ''}
              onChange={(e) => onMaxAgeChange(e.target.value === '' ? null : Number(e.target.value))}
              className="rounded border border-slate-200 bg-white px-1 py-0.5 text-slate-700"
            >
              {AGE_FILTERS.map(({ label, days }) => (
                <option key={label} value={days ?? ''}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {status === 'loading'
          ? siteCount
            ? `Checking ${siteCount} nearby websites…`
            : 'Looking for businesses nearby…'
          : mode === 'postings'
            ? `${sorted.length} businesses hiring · ${totalPostings} postings · ${siteCount} sites checked`
            : `${sorted.length} businesses taking open applications · ${siteCount} sites checked`}
      </p>

      {hiddenCount > 0 && (
        <p className="text-xs text-slate-400">
          {hiddenCount} {hiddenCount === 1 ? 'posting' : 'postings'} hidden by the filters
          {maxAgeDays !== null && ' · postings the site never dated are always shown'}
        </p>
      )}

      {sorted.map((business) => (
        <BusinessCard
          key={business.id}
          business={business}
          selected={business.id === selectedId}
          onSelect={() => onSelect(business)}
        />
      ))}

      {status === 'done' && sorted.length === 0 && (
        <p className="text-slate-500">
          {keyword || (maxAgeDays !== null && mode === 'postings')
            ? 'Nothing matches these filters. Try a wider one.'
            : mode === 'postings'
              ? 'Nobody nearby has a position open. Try a bigger radius.'
              : 'Nobody nearby takes open applications. Try a bigger radius.'}
        </p>
      )}
    </section>
  )
}
