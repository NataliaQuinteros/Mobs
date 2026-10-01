import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractPostings } from '../src/postings.ts'

const url = 'https://acme.example/careers'

// Candidate links found by the fallback are opened to check they really are jobs.
function servePages(pages: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (target: string) => {
      const body = pages[new URL(target).pathname]
      return body === undefined
        ? new Response('Not found', { status: 404 })
        : new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
    }),
  )
}

const jobPage = '<h1>A role</h1><a href="#">Apply now</a>'

beforeEach(() => servePages({}))
afterEach(() => vi.unstubAllGlobals())

describe('extractPostings', () => {
  it('reads schema.org JobPosting data', async () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Barista',
      url: '/careers/barista',
      jobLocation: { '@type': 'Place', address: { addressLocality: 'Madrid' } },
    }
    const html = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`

    expect(await extractPostings({ url, html })).toEqual([
      { title: 'Barista', url: 'https://acme.example/careers/barista', location: 'Madrid' },
    ])
  })

  it('keeps the date a posting went up, wherever the page states it', async () => {
    const jsonLd = { '@type': 'JobPosting', title: 'Barista', url: '/careers/barista', datePosted: '2026-08-11T06:00:00Z' }
    const dated = await extractPostings({ url, html: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` })
    expect(dated[0].postedAt).toBe('2026-08-11')

    // A card that prints the date above its title, which cleanTitle drops from the title itself.
    const card = '<li class="job">Publiée le 18 septembre 2026 <h3>Réceptionniste</h3><a href="/jobs/receptionniste">Voir l’offre</a></li>'
    expect(await extractPostings({ url, html: card })).toEqual([
      { title: 'Réceptionniste', url: 'https://acme.example/jobs/receptionniste', postedAt: '2026-09-18' },
    ])

    // An undated listing, where only the posting's own page says when it went up.
    servePages({ '/careers/frontend-developer': `${jobPage}<p>Online seit dem 01.09.2026</p>` })
    const fromPage = await extractPostings({ url, html: '<a href="/careers/frontend-developer">Frontend Developer</a>' })
    expect(fromPage[0].postedAt).toBe('2026-09-01')
  })

  it('leaves the age unknown when nothing states it', async () => {
    servePages({ '/careers/frontend-developer': jobPage })
    const [posting] = await extractPostings({ url, html: '<a href="/careers/frontend-developer">Frontend Developer</a>' })

    expect(posting.postedAt).toBeUndefined()
  })

  it('does not count menu entries as jobs', async () => {
    // A real careers page: the menu links sit next to it, the jobs below it.
    const html = `
      <nav><a href="/careers">Careers</a><a href="/about">About</a></nav>
      <a href="/careers/students">Students</a>
      <a href="/careers/apprenticeship">Apprenticeship</a>
      <a href="/careers/job-vacancies">Job vacancies</a>
      <a href="/careers/job-vacancies/data-analyst">Data Analyst</a>`
    // every candidate leads to a real job page, so only the rules decide what counts
    servePages({ '/careers/job-vacancies/data-analyst': jobPage, '/careers/students': jobPage, '/careers/apprenticeship': jobPage })

    expect(await extractPostings({ url: 'https://acme.example/careers/job-vacancies', html })).toEqual([
      { title: 'Data Analyst', url: 'https://acme.example/careers/job-vacancies/data-analyst' },
    ])
  })

  it('does not count department filters as jobs', async () => {
    const html = `
      <a href="/careers/data-analytics">Data &amp; Analytics</a>
      <a href="/careers/engineering">Engineering</a>
      <a href="/careers/engineering-manager">Engineering Manager</a>`
    servePages({ '/careers/engineering-manager': jobPage, '/careers/engineering': jobPage, '/careers/data-analytics': jobPage })

    expect(await extractPostings({ url, html })).toEqual([
      { title: 'Engineering Manager', url: 'https://acme.example/careers/engineering-manager' },
    ])
  })

  it('reads the title from the card when the link itself is an empty overlay', async () => {
    const html = `
      <div class="card">
        <a href="/jobs/ict-systemadministrator-100" class="overlay"></a>
        <h6>ICT Systemadministrator 100%</h6>
        <ul><li>Basel</li></ul>
      </div>`
    servePages({ '/jobs/ict-systemadministrator-100': jobPage })

    expect(await extractPostings({ url, html })).toEqual([
      { title: 'ICT Systemadministrator 100%', url: 'https://acme.example/jobs/ict-systemadministrator-100' },
    ])
  })

  it('counts a job page even when it lists similar positions', async () => {
    const similar = Array.from({ length: 8 }, (_, i) => `<a href="/jobs/other-${i}">Other role ${i}</a>`).join('')
    servePages({ '/jobs/verkaeufer-zurich': `<h1>Verkäufer:in</h1><p>Vertragsart: Vollzeit</p>${similar}` })

    expect(await extractPostings({ url, html: '<a href="/jobs/verkaeufer-zurich">Verkäufer:in 100% Zürich</a>' })).toEqual([
      { title: 'Verkäufer:in 100% Zürich', url: 'https://acme.example/jobs/verkaeufer-zurich' },
    ])
  })

  it('reads job widgets that link to an outside platform', async () => {
    // The address says nothing about jobs, so only the markup gives these away.
    const html = `
      <div class="ost-jobs">
        <li class="ost-job"><a href="https://link.ostendis.com/publication/cnc-maschinist/fq18">CNC-Maschinist (a)</a><p class="ost-job-info">Alpnach</p></li>
        <li class="ost-job"><a href="https://link.ostendis.com/publication/monteur/yz73">Monteur Spreitenbach (a)</a></li>
      </div>`
    servePages({})

    expect(await extractPostings({ url, html })).toEqual([
      { title: 'CNC-Maschinist (a)', url: 'https://link.ostendis.com/publication/cnc-maschinist/fq18' },
      { title: 'Monteur Spreitenbach (a)', url: 'https://link.ostendis.com/publication/monteur/yz73' },
    ])
  })

  it('falls back to links that look like job pages', async () => {
    const html = `
      <a href="/careers">Careers</a>
      <a href="/careers/frontend-developer"> Frontend  Developer </a>
      <a href="/careers/backend-developer"><h3>Backend Developer</h3><p>Madrid</p></a>
      <a href="/careers/media/intro-video.mp4">Watch the video</a>
      <a href="/about">About us</a>`
    servePages({ '/careers/frontend-developer': jobPage, '/careers/backend-developer': jobPage })

    expect(await extractPostings({ url, html })).toEqual([
      { title: 'Frontend Developer', url: 'https://acme.example/careers/frontend-developer' },
      { title: 'Backend Developer Madrid', url: 'https://acme.example/careers/backend-developer' },
    ])
  })
})
