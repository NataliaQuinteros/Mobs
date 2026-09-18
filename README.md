# Mobs
Job search engine using nearest locations

Finds businesses around an address (OpenStreetMap), looks for their careers page, and lists the job postings it can read.

## Run it

Requires Node 22+.

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

## Own copy of the map data (optional)

Without it, every search asks the public Overpass server, which is often busy (504) and rate-limits.
With it, finding nearby businesses is instant and offline.

```sh
wsl sudo apt-get install -y osmium-tool
wsl bash backend/scripts/build-places.sh        # REGION=europe by default; downloads ~35 GB, keeps ~1 GB
cd backend && npx tsx scripts/import-places.ts  # builds C:/osm-data/places.db
```

The backend uses the database when `PLACES_DB` points at an existing file, and falls back to Overpass otherwise.
Re-run both steps when you want fresher data (OpenStreetMap extracts are rebuilt daily).

## How it works

```
shared/types.ts        API contract used by both apps
frontend/src/
  api.ts               address lookup (Nominatim) + call to the backend
  components/          SearchForm, ResultsList, BusinessCard
backend/src/
  index.ts             GET /api/search?lat=&lon=&radiusKm= (streams results as they are found)
  search.ts            places → careers page → postings, 5 sites at a time
  places.ts            Overpass query: named places inside the radius tagged
                       website, contact:website, brand:website or url (closest MAX_SITES kept)
  careersPage.ts       homepage link matching the keywords (careers, jobs, work with us, talent, work)
  postings.ts          JSON-LD JobPosting → Greenhouse/Lever APIs → job-looking links
  http.ts              HTML fetch, 2s per site (SITE_TIMEOUT_MS)
```
