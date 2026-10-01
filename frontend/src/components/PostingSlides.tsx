import { useRef, useState } from 'react'
import type { JobPosting, PostingDetails } from '../../../shared/types.ts'
import { ageInDays, describeAge, STALE_DAYS } from '../age.ts'

const SWIPE_PX = 40 // a shorter drag is a tap that wandered, not a swipe

type Props = {
  postings: JobPosting[]
  details: Record<string, PostingDetails | 'failed'>
}

// The open positions as cards, one at a time: the arrows slide the track sideways, and so does a swipe.
export default function PostingSlides({ postings, details }: Props) {
  const [current, setCurrent] = useState(0)
  const swipeFrom = useRef<number | null>(null)
  const last = postings.length - 1

  const go = (step: number) => setCurrent((shown) => Math.min(Math.max(shown + step, 0), last))

  function endSwipe(endX: number) {
    const startX = swipeFrom.current
    swipeFrom.current = null
    if (startX !== null && Math.abs(endX - startX) > SWIPE_PX) go(endX < startX ? 1 : -1)
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Open positions"
      className="mt-3"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
    >
      <div
        className="overflow-hidden"
        onTouchStart={(e) => (swipeFrom.current = e.touches[0].clientX)}
        onTouchEnd={(e) => endSwipe(e.changedTouches[0].clientX)}
      >
        <ul
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {postings.map((posting, i) => (
            <li
              key={posting.url + posting.title}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${postings.length}`}
              // the cards waiting their turn stay out of reach of the keyboard and of screen readers
              aria-hidden={i !== current}
              inert={i !== current}
              className="w-full shrink-0 px-px"
            >
              <Slide posting={posting} detail={details[posting.url]} />
            </li>
          ))}
        </ul>
      </div>

      {postings.length > 1 && (
        <div className="mt-2 flex items-center justify-between">
          <Arrow label="Previous position" glyph="‹" disabled={current === 0} onClick={() => go(-1)} />
          <span className="text-xs text-slate-500">
            {current + 1} / {postings.length}
          </span>
          <Arrow label="Next position" glyph="›" disabled={current === last} onClick={() => go(1)} />
        </div>
      )}
    </section>
  )
}

function Slide({ posting, detail }: { posting: JobPosting; detail?: PostingDetails | 'failed' }) {
  const read = detail !== 'failed' ? detail : undefined
  // The posting's own page is the better source: a listing often gives no date, its page usually does.
  const days = ageInDays(read?.postedAt ?? posting.postedAt)
  const meta = [
    read?.location ?? posting.location,
    read?.employmentType?.replace('_', ' ').toLowerCase(),
    days !== undefined && `posted ${describeAge(days)}`,
  ].filter(Boolean)

  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <a href={posting.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
          {read?.title || posting.title}
        </a>
        {days !== undefined && days >= STALE_DAYS && (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs whitespace-nowrap text-amber-700">
            {`${STALE_DAYS}+ days old`}
          </span>
        )}
      </div>

      {meta.length > 0 && <p className="text-xs text-slate-500">{meta.join(' · ')}</p>}

      {/* Long descriptions scroll inside the card, so every slide is about the same height. */}
      <p className="mt-1 max-h-48 overflow-y-auto text-sm text-slate-600">
        {detail === undefined && 'Reading the posting…'}
        {detail === 'failed' && 'Could not read this posting — open it to see the details.'}
        {read && (read.summary || 'This posting has no description we could read.')}
      </p>
    </article>
  )
}

type ArrowProps = { label: string; glyph: string; disabled: boolean; onClick: () => void }

function Arrow({ label, glyph, disabled, onClick }: ArrowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-full border border-slate-200 px-3 py-1 text-lg leading-none text-slate-600 enabled:hover:bg-slate-100 disabled:opacity-30"
    >
      {glyph}
    </button>
  )
}
