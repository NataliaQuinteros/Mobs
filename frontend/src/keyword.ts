import type { Business } from '../../shared/types.ts'

// Narrowing the results to what someone is actually looking for: "pharma", "verkauf 80%", "chef wil".

// Accents are dropped on both sides, so "zurich" finds "Zürich" and "assistentin" finds "Assistentin".
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const termsOf = (keyword: string) => plain(keyword).split(/\s+/).filter(Boolean)

// Every word typed has to appear somewhere, in any order: "wil pharma" finds the same job as "pharma wil".
const matches = (text: string, terms: string[]) => terms.every((term) => plain(text).includes(term))

// Businesses and postings worth keeping for what was typed. A business whose own name matches keeps all
// of its postings — you asked for that employer. Otherwise only the postings that match survive, and a
// business left with none drops out, CV form or not: it is not what the search was for.
export function keywordFiltered(businesses: Business[], keyword: string): Business[] {
  const terms = termsOf(keyword)
  if (terms.length === 0) return businesses

  return businesses
    .map((business) =>
      matches(business.name, terms)
        ? business
        : { ...business, postings: business.postings.filter((posting) => matches(`${posting.title} ${posting.location ?? ''}`, terms)) },
    )
    .filter((business) => business.postings.length > 0 || matches(business.name, terms))
}
