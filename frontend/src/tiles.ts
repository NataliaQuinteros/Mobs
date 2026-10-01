import { layers, namedFlavor } from '@protomaps/basemaps'
import { addProtocol, setWorkerUrl, type StyleSpecification } from 'maplibre-gl'
// ?worker&url has the bundler build the worker with its own imports and hand back where it landed.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Protocol } from 'pmtiles'

// Vector tiles are parsed in a web worker, which MapLibre looks for next to its own file. Once bundled
// that address does not exist any more, and without the worker the map draws its background and
// nothing else — no roads, no labels. So the worker is named outright.
setWorkerUrl(workerUrl)

// Where the basemap comes from. Two ways, and the choice lives only in this file:
//
//   nothing set     OpenFreeMap's hosted tiles. No key, no quota, someone else's server.
//   VITE_PMTILES_URL  one .pmtiles archive of your own, read straight out of storage with range
//                     requests. No tile server to run, and nothing to pay beyond holding the file.
//
// Vite bakes this in when the page is built, so it is a build-time setting, not a runtime one.
const archive = import.meta.env.VITE_PMTILES_URL

export type TileSource = {
  style: string | StyleSpecification
  attribution: string
}

const openFreeMap: TileSource = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  attribution: [
    '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>',
    '<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a>',
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
  ].join(' '),
}

// The archive is cut from the Protomaps basemap, an ODbL produced work, so it is credited as one.
const PROTOMAPS = [
  '<a href="https://github.com/protomaps/basemaps" target="_blank" rel="noreferrer">Protomaps</a>',
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
].join(' ')

// Labels and icons are separate files from the tiles. These are Protomaps' own, hotlinked; the
// basemaps-assets repository publishes them as a zip to put beside your archive instead.
const ASSETS = 'https://protomaps.github.io/basemaps-assets'

// v4 is the style package the daily planet builds are made with — v5 assets are not published.
const SPRITE = `${ASSETS}/sprites/v4/light`

function ownArchive(url: string): TileSource {
  addProtocol('pmtiles', new Protocol().tile) // teaches MapLibre to read pmtiles:// urls

  return {
    style: {
      version: 8,
      glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
      sprite: SPRITE,
      sources: {
        protomaps: { type: 'vector', url: `pmtiles://${url}`, attribution: PROTOMAPS },
      },
      layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
    },
    attribution: PROTOMAPS,
  }
}

export const tiles: TileSource = archive ? ownArchive(archive) : openFreeMap
