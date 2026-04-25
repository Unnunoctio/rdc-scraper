import { describe, it, expect } from 'vitest'
import { resolvePath, resolvePaths, extractField } from '../path-resolver'

describe('resolvePath', () => {
  it('resolves a simple key', () => {
    expect(resolvePath({ a: 1 }, 'a')).toBe(1)
  })

  it('resolves nested keys with dot notation', () => {
    expect(resolvePath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  it('resolves array index', () => {
    expect(resolvePath({ items: ['x', 'y', 'z'] }, 'items.1')).toBe('y')
  })

  it('returns undefined for missing key', () => {
    expect(resolvePath({ a: 1 }, 'b')).toBeUndefined()
  })

  it('returns undefined when intermediate key is null', () => {
    expect(resolvePath({ a: null }, 'a.b')).toBeUndefined()
  })
})

describe('resolvePaths', () => {
  it('returns first non-null result', () => {
    expect(resolvePaths({ b: 99 }, ['a', 'b'])).toBe(99)
  })

  it('returns undefined when no path resolves', () => {
    expect(resolvePaths({ c: 1 }, ['a', 'b'])).toBeUndefined()
  })
})

describe('extractField', () => {
  it('coerces to number', () => {
    expect(extractField({ v: '3.5' }, { paths: ['v'], type: 'number' })).toBe(3.5)
  })

  it('coerces to int', () => {
    expect(extractField({ v: '7.9' }, { paths: ['v'], type: 'int' })).toBe(7)
  })

  it('returns undefined when path not found', () => {
    expect(extractField({}, { paths: ['x'], type: 'string' })).toBeUndefined()
  })
})
