import { describe, expect, it } from 'vitest'
import { findCvTarget } from '../src/applications.ts'

const page = (html: string) => ({ url: 'https://acme.example/careers', html: `<body>${html}</body>` })

describe('findCvTarget', () => {
  it('finds an upload form', () => {
    const html = '<h1>Trabaja con nosotros</h1><form><input type="text" name="name"><input type="file" name="cv"></form>'
    expect(findCvTarget(page(html))).toBe('https://acme.example/careers')
  })

  it('finds an email address for open applications', () => {
    const html = '<p>Envíanos tu CV a <a href="mailto:rrhh@acme.example">rrhh@acme.example</a></p>'
    expect(findCvTarget(page(html))).toBe('mailto:rrhh@acme.example')
  })

  it('accepts a page that invites open applications without a form', () => {
    expect(findCvTarget(page('<p>Send us your résumé any time.</p>'))).toBe('https://acme.example/careers')
  })

  it('ignores a page that says nothing is open', () => {
    const html = '<p>We have no current vacancies.</p><a href="mailto:hello@acme.example">contact</a>'
    expect(findCvTarget(page(html))).toBeUndefined()
  })

  it('ignores a page with no way to apply', () => {
    expect(findCvTarget(page('<p>About our company and our work.</p>'))).toBeUndefined()
  })
})
