import { useState, type FormEvent } from 'react'
import type { SearchParams } from '../../../shared/types.ts'
import { geocode, type Place } from '../api.ts'
import AddressInput from './AddressInput.tsx'

// Where the search starts from, and how it was chosen: an address, the device, or a pin on the map.
// Only an address knows its own name, so each one carries the label the form shows for it.
export type PickedLocation = { lat: number; lon: number; label: string; source: 'address' | 'device' | 'map' }

type Props = {
  loading: boolean
  address: string
  location: PickedLocation | null
  radiusKm: number
  onAddressChange: (address: string) => void
  onLocationChange: (location: PickedLocation) => void
  onRadiusChange: (radiusKm: number) => void
  onSearch: (params: SearchParams) => void
}

const locationErrors: Record<number, string> = {
  1: 'Your browser is blocking location for this site: allow it in the icon at the left of the address bar.',
  2: 'Windows could not work out where you are.',
  3: 'Getting your location took too long.',
}

export default function SearchForm({
  loading,
  address,
  location,
  radiusKm,
  onAddressChange,
  onLocationChange,
  onRadiusChange,
  onSearch,
}: Props) {
  // What just happened — a lookup running, or one that failed — kept against the location it was said
  // under. Once another location is chosen, from anywhere, the note is stale and the location speaks
  // for itself. That also covers an answer that arrives late, after a pin has moved on.
  const [note, setNote] = useState<{ text: string; about: PickedLocation | null }>({ text: '', about: null })
  const [lookedUp, setLookedUp] = useState('') // the typed text the current location came from
  const say = (text: string) => setNote({ text, about: location })
  const message = (note.about === location && note.text) || location?.label

  function pickPlace(place: Place) {
    setLookedUp(place.displayName)
    onLocationChange({ lat: place.lat, lon: place.lon, label: place.displayName, source: 'address' })
  }

  // Submitting without choosing a suggestion: look the typed text up as it stands.
  async function resolveAddress(): Promise<{ lat: number; lon: number } | null> {
    if (!address.trim()) return location && { lat: location.lat, lon: location.lon } // the pin, or wherever we are
    if (address === lookedUp && location) return { lat: location.lat, lon: location.lon } // already know where this is
    try {
      setLookedUp(address)
      const place = await geocode(address)
      pickPlace(place)
      return { lat: place.lat, lon: place.lon }
    } catch (err) {
      say((err as Error).message)
      return null
    }
  }

  function locateMe() {
    if (!navigator.geolocation || !window.isSecureContext) {
      say('Your browser only shares your location over https or on localhost. Type an address instead.')
      return
    }

    say('Getting your location…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        onAddressChange('') // the typed address is not where we are
        onLocationChange({
          lat: latitude,
          lon: longitude,
          label: `Using your location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          source: 'device',
        })
      },
      (error) => say(`${locationErrors[error.code] ?? 'Could not get your location.'} Type an address instead.`),
      { timeout: 10_000, maximumAge: 300_000 }, // without a timeout the browser can wait forever
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const place = await resolveAddress()
    if (place) onSearch({ ...place, radiusKm })
    else if (!address.trim()) say('Type an address, drop a pin on the map, or use your location')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <AddressInput value={address} onChange={onAddressChange} onPick={pickPlace} />
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
          onChange={(e) => onRadiusChange(Number(e.target.value))}
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
