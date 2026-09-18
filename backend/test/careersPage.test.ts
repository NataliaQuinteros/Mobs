import { describe, expect, it } from 'vitest'
import { findCareersLink } from '../src/careersPage.ts'

const page = (links: string) => ({ url: 'https://acme.example/', html: `<nav>${links}</nav>` })

describe('findCareersLink', () => {
  it('prefers "Careers" over a weaker "work" match', () => {
    const html = page('<a href="/our-work">Our work</a><a href="/en/careers">Careers</a>')
    expect(findCareersLink(html)).toBe('https://acme.example/en/careers')
  })

  it('matches by URL when the link text has no keyword', () => {
    expect(findCareersLink(page('<a href="/jobs">Join us</a>'))).toBe('https://acme.example/jobs')
  })

  it('ignores email links and unrelated words', () => {
    expect(findCareersLink(page('<a href="mailto:jobs@acme.example">jobs@acme.example</a><a href="/network">Network</a>'))).toBeNull()
  })
})
