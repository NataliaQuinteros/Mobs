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

  it('matches keywords that carry accents', () => {
    // "únete" starts with an accent, so the old ASCII word boundary never matched it
    expect(findCareersLink(page('<a href="/es/oportunidades">Únete al equipo</a>'))).toBe('https://acme.example/es/oportunidades')
    expect(findCareersLink(page('<a href="/fr/nous">Carrières</a>'))).toBe('https://acme.example/fr/nous')
  })

  it('follows a French vacancies button, by its words or its address', () => {
    expect(findCareersLink(page('<a href="/fr/rh">Postes vacants</a>'))).toBe('https://acme.example/fr/rh')
    // the address spells "postes à pourvoir" without its accent, as addresses do
    expect(findCareersLink(page('<a href="/fr/postes-a-pourvoir">Rejoignez l’aventure</a>'))).toBe(
      'https://acme.example/fr/postes-a-pourvoir',
    )
  })

  it('ignores email links and unrelated words', () => {
    expect(findCareersLink(page('<a href="mailto:jobs@acme.example">jobs@acme.example</a><a href="/network">Network</a>'))).toBeNull()
  })
})
