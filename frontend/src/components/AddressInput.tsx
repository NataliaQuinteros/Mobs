import { useEffect, useRef, useState } from 'react'
import { suggestPlaces, type Place } from '../api.ts'

type Props = {
  value: string
  onChange: (text: string) => void
  onPick: (place: Place) => void
}

// Address field that suggests places as you type.
export default function AddressInput({ value, onChange, onPick }: Props) {
  const [found, setFound] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const suggestions = value.trim().length < 3 ? [] : found // a short query has nothing to offer
  const [highlighted, setHighlighted] = useState(0)
  const justPicked = useRef(false)

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false // don't look up the text we just filled in
      return
    }
    if (value.trim().length < 3) return

    // One request once typing pauses, not one per keystroke.
    const stop = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setFound(await suggestPlaces(value, stop.signal))
        setHighlighted(0)
        setOpen(true)
      } catch {
        // typing again cancels the previous request; nothing to report
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      stop.abort()
    }
  }, [value])

  function pick(place: Place) {
    justPicked.current = true
    onChange(place.displayName)
    onPick(place)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') setHighlighted((i) => (i + 1) % suggestions.length)
    if (e.key === 'ArrowUp') setHighlighted((i) => (i - 1 + suggestions.length) % suggestions.length)
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' && suggestions[highlighted]) {
      e.preventDefault() // choose the suggestion instead of submitting the form
      pick(suggestions[highlighted])
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault()
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} // let a click on the list land first
        placeholder="Address, e.g. Gran Vía 1, Madrid"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="address-suggestions"
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />

      {open && suggestions.length > 0 && (
        <ul
          id="address-suggestions"
          role="listbox"
          className="absolute z-1000 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {suggestions.map((place, i) => (
            <li key={`${place.lat},${place.lon}`} role="option" aria-selected={i === highlighted}>
              <button
                type="button"
                onMouseDown={() => pick(place)}
                onMouseEnter={() => setHighlighted(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${i === highlighted ? 'bg-indigo-50' : ''}`}
              >
                {place.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
