import { config } from './config.ts'

export type Page = { url: string; html: string }

const MAX_BYTES = 2_000_000

// Fetches an HTML page. Returns null instead of throwing, so callers can just try the next URL.
export async function fetchHtml(url: string): Promise<Page | null> {
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': config.scrapeUserAgent, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(config.siteTimeoutMs),
    })
    const type = res.headers.get('content-type') ?? 'text/html' // servers that send no type are usually serving html
    const isHtml = type.includes('text/html') || type.includes('xhtml')
    const tooBig = Number(res.headers.get('content-length')) > MAX_BYTES
    if (!res.ok || !isHtml || tooBig) return null

    return { url: res.url, html: await res.text() }
  } catch {
    return null
  }
}
