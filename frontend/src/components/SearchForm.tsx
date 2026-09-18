import { useEffect, useState, type FormEvent } from 'react'
import type { SearchParams } from '../../../shared/types.ts'
import { geocode } from '../api.ts'

type Props = {
  loading: boolean
  onSearch: (params: SearchParams) => void
  onLocationPicked: (params: SearchParams | null) => void // shows the area on the map before searching
}

const locationErrors: Record<number, string> = {
  1: 'Your browser is blocking location for this site: allow it in the icon at the left of the address bar.',
  2: 'Windows could not work out where you are.',
  3: 'Getting your location took too long.',
}

export default function SearchForm({ loading, onSearch, onLocationPicked }: Props) {
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState(2)
  const [message, setMessage] = useState('')
  const [lookedUp, setLookedUp] = useState('')

  useEffect(() => {
    onLocationPicked(coords && { ...coords, radiusKm })
  }, [coords, radiusKm, onLocationPicked])

  // Looking the address up when the field is left, rather than on every keystroke, as Nominatim asks.
  async function resolveAddress(): Promise<{ lat: number; lon: number } | null> {
    if (!address.trim()) return coords
    if (address === lookedUp && coords) return coords // already know where this is
    try {
      setLookedUp(address)
      const place = await geocode(address)
      setMessage(place.displayName)
      setCoords({ lat: place.lat, lon: place.lon })
      return { lat: place.lat, lon: place.lon }
    } catch (err) {
      setMessage((err as Error).message)
      return null
    }
  }

  function locateMe() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setMessage('Your browser only shares your location over https or on localhost. Type an address instead.')
      return
    }

    setMessage('Getting your location…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lon: position.coords.longitude })
        setAddress('')
        setMessage(`Using your location (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`)
      },
      (error) => setMessage(`${locationErrors[error.code] ?? 'Could not get your location.'} Type an address instead.`),
      { timeout: 10_000, maximumAge: 300_000 }, // without a timeout the browser can wait forever
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const place = await resolveAddress()
    if (place) onSearch({ ...place, radiusKm })
    else if (!address.trim()) setMessage('Type an address or use your location')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={resolveAddress}
          placeholder="Address, e.g. Gran Vía 1, Madrid"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          type="button"
          onClick={locateMe}
          className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-100"
        >
          Use my location
        </button>
      </div>

      <label className="flex items-center gap-3">
        <span className="whitespace-nowrap">Radius</span>
        <input
          type="range"
          min={0.5}
          max={10}
          step={0.5}
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-14 text-right tabular-nums">{radiusKm} km</span>
      </label>

      <button
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Searching…' : 'Search jobs'}
      </button>

      {message && <p className="text-sm text-slate-500">{message}</p>}
    </form>
  )
}
