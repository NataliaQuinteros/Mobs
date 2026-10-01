# Work Radar
Job search engine using nearest locations

Finds businesses around an address (OpenStreetMap), looks for their careers page, and lists the job postings it can read.

## Run it

Requires Node 22+. For job lists that need JavaScript: `cd backend && npx playwright install chromium`
(or set `RENDER_JS=false` to skip them and search about three times faster).

```sh
# Backend → http://localhost:3001
cd backend
npm install
cp .env.example .env   # optional: set USER_AGENT with your contact info
npm run dev

# Frontend → http://localhost:5173 (proxies /api to the backend)
cd frontend
npm install
npm run dev            # or `npm run dev:mock` to use fake data without the backend
```

Tests: `cd backend && npm test`

## Run it with Docker

```sh
docker compose up --build   # → http://localhost:8080
```

Two containers: the API, and nginx serving the built page and passing `/api` through to it. Both images
build from the repo root, because each app imports `shared/types.ts`.

Settings come from the environment, so a `.env` beside `docker-compose.yml` is the place to change them:

```sh
USER_AGENT=WorkRadar/0.1 (your-email@example.com)   # OpenStreetMap asks who is calling
WEB_PORT=8080          # where the page is served
PLACES_DIR=./data      # folder holding places.db, mounted read-only (see below)
RENDER_JS=false        # skip the headless browser
MAX_SITES=100
```

The backend image carries Chromium (~1 GB) for job lists built by JavaScript. If it cannot start in your
container the search still runs without it, logging a warning — set `RENDER_JS=false` to skip it outright
and search about three times faster.

## Own copy of the map tiles (optional)

The map draws vector tiles. Out of the box they come from [OpenFreeMap](https://openfreemap.org), which
needs no key and sets no quota. To depend on nobody, host the tiles yourself: one `.pmtiles` file, read
straight from storage with range requests, with no tile server to run.

```sh
# a one-off copy out of the daily planet build — only the region asked for is downloaded
pmtiles extract https://build.protomaps.com/<yyyymmdd>.pmtiles switzerland.pmtiles \
  --bbox=5.9,45.8,10.5,47.8 --maxzoom=12
```

Latest build date: [build-metadata.protomaps.dev/builds.json](https://build-metadata.protomaps.dev/builds.json).
Switzerland measured 122 MB at `--maxzoom=12`, 249 MB at 13 and 477 MB at 14 — zoom decides the size far
more than the bounding box does, and 12 still reads well on a map this small. Upload the file anywhere
S3-compatible that allows CORS and range requests (Cloudflare R2's free tier holds it comfortably;
GitHub Pages will not, its per-file limit is 100 MB), then point the page at it:

```sh
VITE_PMTILES_URL=https://your-bucket.example/switzerland.pmtiles npm run build
# under Docker it is a build argument: docker compose build with VITE_PMTILES_URL set
```

Fonts and icons still come from Protomaps' asset host; the
[basemaps-assets](https://github.com/protomaps/basemaps-assets) repository publishes them as a zip to
put beside your archive. Either way the basemap is an ODbL produced work, so the OpenStreetMap credit
in the map's corner has to stay.

## Own copy of the map data (optional)

Without it, every search asks the public Overpass server, which is often busy (504) and rate-limits.
With it, finding nearby businesses is instant and offline.

```sh
wsl sudo apt-get install -y osmium-tool
wsl bash backend/scripts/build-places.sh        # REGION=europe by default; downloads ~35 GB, keeps ~1 GB
cd backend && npx tsx scripts/import-places.ts  # builds C:/osm-data/places.db
```

The backend uses the database when `PLACES_DB` points at an existing file, and falls back to Overpass otherwise.
Under Docker that path is `/data/places.db`: put the file in the folder `PLACES_DIR` names (`./data` by default).
Re-run both steps when you want fresher data (OpenStreetMap extracts are rebuilt daily).

## How it works

```
shared/types.ts        API contract used by both apps
frontend/src/
  api.ts               address lookup (Nominatim) + call to the backend
  components/          SearchForm, ResultsList, BusinessCard
backend/src/
  index.ts             GET /api/search?lat=&lon=&radiusKm= (streams results as they are found)
  search.ts            places → careers page → jobs list → postings, 5 sites at a time
  render.ts            opens a page in headless Chromium when its job list needs JavaScript
  applications.ts      spots CV forms and open-application addresses
  places.ts            Overpass query: named places inside the radius tagged
                       website, contact:website, brand:website or url (closest MAX_SITES kept)
  careersPage.ts       homepage link matching the keywords (careers, jobs, work with us, talent, work)
  postings.ts          JSON-LD JobPosting → Greenhouse/Lever APIs → job-looking links
  http.ts              HTML fetch, 2s per site (SITE_TIMEOUT_MS)
```
