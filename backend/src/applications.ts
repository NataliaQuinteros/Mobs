import * as cheerio from 'cheerio'

import type { Page } from './http.ts'
import { visibleText, wordRegex } from './words.ts'

// Wording used for open applications ("send us your CV") in the languages the keyword list covers.
const CV_WORDS = wordRegex(
  'cv', 'curriculum', 'currículum', 'curriculo', 'currículo', 'résumé', 'resume', 'lebenslauf',
  'candidatura espontánea', 'autocandidatura', 'candidature spontanée', 'spontaneous application',
  'open application', 'initiativbewerbung', 'bewerbung', 'candidatura', 'postula', 'postúlate',
  'apply now', 'solicitud', 'envíanos', 'envianos',
)

// Careers pages that say there is nothing open right now.
const NOTHING_OPEN = wordRegex(
  'no current vacancies', 'no open vacancies', 'no vacancies', 'no current openings', 'no openings',
  'no open positions', 'no current positions', 'no jobs available', 'not hiring',
  'no hay vacantes', 'no hay ofertas', 'no hay puestos', 'sin vacantes', 'no tenemos vacantes',
  'aucun poste', 'pas de poste', 'keine offenen stellen', 'keine stellen', 'nessuna posizione',
)

// Where to send a CV when a page has no listed positions: an upload form, an application link, or an email address.
export function findCvTarget(page: Page): string | undefined {
  const $ = cheerio.load(page.html)
  const text = visibleText($)
  if (NOTHING_OPEN.test(text)) return undefined

  const uploadForm = $('form').filter((_, form) => $(form).find('input[type="file"]').length > 0)
  if (uploadForm.length > 0) return page.url

  const link = $('a[href]')
    .toArray()
    .find((a) => {
      const href = $(a).attr('href')!
      const text = $(a).text()
      if (href.startsWith('mailto:')) return CV_WORDS.test(href) || CV_WORDS.test(text) || /jobs|careers|rrhh|hr|empleo|recruit/i.test(href)
      return CV_WORDS.test(text) && /apply|candidat|postul|bewerb|solicit|cv|form/i.test(`${href} ${text}`)
    })
  if (link) return new URL($(link).attr('href')!, page.url).href

  // A page that talks about sending a CV, without a form we recognise, is still worth offering.
  return CV_WORDS.test(text) ? page.url : undefined
}
