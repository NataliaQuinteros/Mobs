import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPosting } from '../src/postingDetails.ts'

const htmlResponse = (html: string) =>
  new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })

afterEach(() => vi.unstubAllGlobals())

describe('readPosting', () => {
  it('reads the structured data a posting publishes', async () => {
    const jsonLd = {
      '@type': 'JobPosting',
      title: 'Frontend Developer',
      description: '<p>You will build our web app.</p><p>React experience wanted.</p>',
      employmentType: 'FULL_TIME',
      datePosted: '2026-09-01', // schema.org's name for it
      jobLocation: { address: { addressLocality: 'Lausanne' } },
    }
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`)))

    const posting = await readPosting('https://acme.example/jobs/frontend')

    expect(posting).toMatchObject({
      title: 'Frontend Developer',
      summary: 'You will build our web app.React experience wanted.',
      location: 'Lausanne',
      employmentType: 'FULL_TIME',
      postedAt: '2026-09-01',
    })
  })

  it('falls back to the page text, without the furniture around it', async () => {
    const html = `<html><head><title>Job</title></head><body>
      <nav>Home Careers Contact</nav>
      <main><h1>Barista</h1><p>${'Serving coffee to our guests. '.repeat(40)}</p></main>
      <footer>© Acme</footer></body></html>`
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(html)))

    const posting = await readPosting('https://acme.example/jobs/barista')

    expect(posting?.title).toBe('Barista')
    expect(posting?.summary).toContain('Serving coffee')
    expect(posting?.summary).not.toContain('Acme')
    expect(posting?.summary.length).toBeLessThanOrEqual(601)
  })
})
