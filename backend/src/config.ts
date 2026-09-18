import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile()

const env = process.env

// Ordered from clearest to vaguest: a page saying both "Careers" and "Our work" should give us the careers page.
const DEFAULT_KEYWORDS = [
  'careers,jobs,work with us,join us,join our team,join the team,vacancies,job openings,we are hiring', // English
  'trabaja con nosotros,trabaje con nosotros,ofertas de empleo,oferta de empleo,empleo,empleos,vacantes,únete,unete', // Spanish
  'treballa amb nosaltres,ocupació,feina', // Catalan
  'trabalhe conosco,carreiras,emprego,vagas', // Portuguese
  "nous rejoindre,offres d'emploi,offres d’emploi,offre d'emploi,recrutement,carrières,emplois", // French, both apostrophes
  'karriere,stellenangebote,stellenanzeigen,jobangebote,mitarbeiter gesucht', // German
  'lavora con noi,opportunità di lavoro,offerte di lavoro,carriere,lavoro', // Italian
  'werken bij,vacature,vacatures', // Dutch
  'talent,talento,recursos humanos,work,trabajo', // vaguest: matched last on purpose
].join(',')

export const config = {
  port: Number(env.PORT ?? 3001),
  maxRadiusKm: Number(env.MAX_RADIUS_KM ?? 10),
  maxSites: Number(env.MAX_SITES ?? 1000),
  siteTimeoutMs: Number(env.SITE_TIMEOUT_MS ?? 4000), // how long one business website gets to answer
  userAgent: env.USER_AGENT ?? 'MobsJobSearch/0.1', // OpenStreetMap wants an app that identifies itself
  scrapeUserAgent: env.SCRAPE_USER_AGENT ?? 'Mozilla/5.0 (compatible; MobsJobSearch/0.1)', // business sites often refuse unknown agents
  // Local copy of the OpenStreetMap places, built by scripts/build-places.sh. Falls back to the Overpass API when missing.
  placesDb: env.PLACES_DB ?? 'C:/osm-data/places.db',
  overpassUrl: env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
  overpassRetries: Number(env.OVERPASS_RETRIES ?? 2),
  overpassRetryDelayMs: Number(env.OVERPASS_RETRY_DELAY_MS ?? 2000),
  // Checked in order: earlier keywords win when a page has several matching links.
  // Most business websites are not in English, so the default covers the bigger European languages.
  keywords: (env.KEYWORDS ?? DEFAULT_KEYWORDS).split(',').map((k) => k.trim().toLowerCase()),
}
