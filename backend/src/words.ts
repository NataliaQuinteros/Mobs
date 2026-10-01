import type { CheerioAPI } from 'cheerio'

// The readable text of a page, with tags kept apart: without the spacing,
// <h1>A role</h1><a>Apply now</a> reads as "A roleApply now" and no word matches.
export function visibleText($: CheerioAPI): string {
  $('script, style, noscript').remove()
  $('body').find('*').after(' ')
  return $('body').text().replace(/\s+/g, ' ')
}

// Matches whole words, accents included.
// JavaScript's \b only knows ASCII letters, so /\brésumé\b/ and /\búnete\b/ never match anything.
export function wordRegex(...words: string[]): RegExp {
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'iu')
}
