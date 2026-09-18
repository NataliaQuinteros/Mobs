import type { Business } from '../../../shared/types.ts'
import BusinessCard from './BusinessCard.tsx'

export type Status = 'idle' | 'loading' | 'done' | 'error'

type Props = {
  status: Status
  businesses: Business[]
  siteCount: number
  error: string
}

export default function ResultsList({ status, businesses, siteCount, error }: Props) {
  if (status === 'idle') return null
  if (status === 'error') return <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>

  const sorted = [...businesses].sort((a, b) => a.distanceKm - b.distanceKm)
  const totalPostings = sorted.reduce((sum, business) => sum + business.postings.length, 0)

  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-500">
        {status === 'loading'
          ? siteCount
            ? `Checking ${siteCount} nearby websites…`
            : 'Looking for businesses nearby…'
          : `${sorted.length} businesses hiring · ${totalPostings} postings · ${siteCount} sites checked`}
      </p>

      {sorted.map((business) => (
        <BusinessCard key={business.id} business={business} />
      ))}

      {status === 'done' && sorted.length === 0 && (
        <p className="text-slate-500">No job pages found. Try a bigger radius.</p>
      )}
    </section>
  )
}
