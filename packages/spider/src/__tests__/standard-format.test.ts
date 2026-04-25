import { describe, it, expect } from 'vitest'
import { isComplete } from '../standard-format'

describe('isComplete', () => {
  it('returns true when all required fields are present', () => {
    expect(isComplete({
      name: 'Cerveza Jumbo', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo',
      volumeMl: 500, abv: 5.0, packaging: 'Lata',
    })).toBe(true)
  })

  it('returns false when brand is missing', () => {
    expect(isComplete({
      name: 'Cerveza', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo',
    })).toBe(false)
  })

  it('returns false when volumeMl is missing', () => {
    expect(isComplete({
      name: 'Cerveza', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo', abv: 5.0, packaging: 'Lata',
    })).toBe(false)
  })

  it('returns false when abv is missing', () => {
    expect(isComplete({
      name: 'Cerveza', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo', volumeMl: 500, packaging: 'Lata',
    })).toBe(false)
  })

  it('returns false when packaging is missing', () => {
    expect(isComplete({
      name: 'Cerveza', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo', volumeMl: 500, abv: 5.0,
    })).toBe(false)
  })

  it('returns true when abv is 0 (non-alcoholic)', () => {
    expect(isComplete({
      name: 'Kombucha', brand: 'Acme', price: 500, bestPrice: 500,
      url: 'https://example.com/p', source: 'example',
      volumeMl: 330, abv: 0, packaging: 'Lata',
    })).toBe(true)
  })
})
