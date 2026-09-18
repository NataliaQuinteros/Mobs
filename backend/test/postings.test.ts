import { describe, expect, it } from 'vitest'
import { extractPostings } from '../src/postings.ts'

const url = 'https://acme.example/careers'

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

  it('falls back to links that look like job pages', async () => {
    const html = `
      <a href="/careers">Careers</a>
      <a href="/careers/frontend-developer"> Frontend  Developer </a>
      <a href="/careers/backend-developer"><h3>Backend Developer</h3><p>Madrid</p></a>
      <a href="/careers/media/intro-video.mp4">Watch the video</a>
      <a href="/about">About us</a>`

    expect(await extractPostings({ url, html })).toEqual([
      { title: 'Frontend Developer', url: 'https://acme.example/careers/frontend-developer' },
      { title: 'Backend Developer Madrid', url: 'https://acme.example/careers/backend-developer' },
    ])
  })
})
