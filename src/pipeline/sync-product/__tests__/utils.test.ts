import { describe, it, expect } from 'vitest'
import { generateProductName, generateProductSlug, formatVolume, formatAbv } from '../utils'

const baseDrink = { name: 'Lager', brand: 'Austral', abv: 5.0, packaging: 'Lata', volume: 500 }

describe('generateProductName', () => {
  it('generates singular name', () => {
    expect(generateProductName(baseDrink, 'Cervezas', 1))
      .toBe('Cerveza Austral Lager Lata 5° 500ml')
  })

  it('generates pack name when quantity > 1', () => {
    expect(generateProductName(baseDrink, 'Cervezas', 6))
      .toBe('Pack 6 un. Cerveza Austral Lager Lata 5° 500ml')
  })

  it('formats volume in litres when >= 1000ml and multiple of 1000', () => {
    expect(generateProductName({ ...baseDrink, volume: 1000 }, 'Cervezas', 1))
      .toBe('Cerveza Austral Lager Lata 5° 1L')
  })
})

describe('formatVolume', () => {
  it('returns ml for volumes under 1000', () => {
    expect(formatVolume(500)).toBe('500ml')
  })

  it('returns L for exact litre multiples >= 1000', () => {
    expect(formatVolume(1000)).toBe('1L')
    expect(formatVolume(2000)).toBe('2L')
  })

  it('returns ml for non-multiple-of-1000 volumes', () => {
    expect(formatVolume(750)).toBe('750ml')
  })
})

describe('formatAbv', () => {
  it('appends degree symbol', () => {
    expect(formatAbv(5.5)).toBe('5.5°')
  })
})

describe('generateProductSlug', () => {
  it('generates a kebab-case slug', () => {
    const slug = generateProductSlug('ABC123', 'Cerveza Austral Lager', 500)
    expect(slug).toMatch(/^abc123-cerveza-austral-lager-500$/)
  })
})
