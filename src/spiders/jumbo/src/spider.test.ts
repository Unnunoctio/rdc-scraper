import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JumboSpider } from './spider'

// Realistic Jumbo PDP response shape
const makePdpResponse = (overrides: Record<string, unknown> = {}) => ({
  items: [
    {
      name: 'Cerveza Kunstmann Torobayo Lager 500ml',
      price: 2990,
      listPrice: 3490,
      images: ['https://jumbo.vteximg.com.br/arquivos/ids/234567-300-300/cerveza.jpg'],
    },
  ],
  brand: 'Kunstmann',
  reference: 'KUN-500',
  categoryNames: ['Beers', 'Cervezas'],
  slug: 'cerveza-kunstmann-torobayo-lager-500ml',
  specifications: [
    { key: 'Graduacion Alcoholica', value: ['4.9°'] },
    { key: 'Envase', value: ['Lata'] },
    { key: 'Cantidad', value: ['1'] },
  ],
  ...overrides,
})

const makeConfig = (overrides: Record<string, unknown> = {}) => ({
  category_urls: ['cervezas'],
  product_list_url: 'https://api.jumbo.cl/plp',
  product_details_url: 'https://api.jumbo.cl/pdp',
  product_url: { prefix: 'https://www.jumbo.cl/', postfix: '/p' },
  page_size: 50,
  store: 'jumbo',
  headers: { 'X-Api-Key': 'test-key' },
  ...overrides,
})

describe('JumboSpider._formatProduct', () => {
  let spider: JumboSpider

  beforeEach(() => {
    spider = new JumboSpider(makeConfig())
  })

  it('extracts all fields from a realistic PDP response', () => {
    const raw = makePdpResponse()
    const product = spider._formatProduct(raw, 'cerveza-kunstmann-torobayo-lager-500ml')

    expect(product.name).toBe('Cerveza Kunstmann Torobayo Lager 500ml')
    expect(product.price).toBe(3490)
    expect(product.bestPrice).toBe(2990)
    expect(product.url).toBe('https://www.jumbo.cl/cerveza-kunstmann-torobayo-lager-500ml/p')
    expect(product.source).toBe('jumbo')
    expect(product.brand).toBe('Kunstmann')
    expect(product.sku).toBe('KUN-500')
    expect(product.category).toBe('Cervezas')
    expect(product.abv).toBe(4.9)
    expect(product.volumeMl).toBe(500)
    expect(product.packaging).toBe('Lata')
    expect(product.quantity).toBe(1)
  })

  it('strips image dimension params from image URL', () => {
    const raw = makePdpResponse({
      items: [
        {
          name: 'Vino Santa Rita 750ml',
          price: 5990,
          listPrice: 7490,
          images: ['https://jumbo.vteximg.com.br/arquivos/ids/111222-500-500/vino.jpg'],
        },
      ],
    })
    const product = spider._formatProduct(raw, 'vino-santa-rita-750ml')
    expect(product.imageUrl).toBe('https://jumbo.vteximg.com.br/arquivos/ids/111222/vino.jpg')
  })

  it('extracts volumeMl from product name in litres', () => {
    const raw = makePdpResponse({
      items: [
        {
          name: 'Cerveza Heineken 1L',
          price: 1990,
          listPrice: 2490,
          images: [],
        },
      ],
    })
    const product = spider._formatProduct(raw, 'cerveza-heineken-1l')
    expect(product.volumeMl).toBe(1000)
  })

  it('returns Botella packaging for destilados category', () => {
    const raw = makePdpResponse({
      categoryNames: ['Alcoholes', 'Destilados'],
      specifications: [],
    })
    const product = spider._formatProduct(raw, 'pisco-capel')
    expect(product.packaging).toBe('Botella')
  })

  it('extracts quantity=6 from Pack spec', () => {
    const raw = makePdpResponse({
      items: [
        {
          name: 'Pack Cerveza Heineken 500ml 6un.',
          price: 9990,
          listPrice: 12000,
          images: [],
        },
      ],
      specifications: [{ key: 'Cantidad', value: ['6'] }],
    })
    const product = spider._formatProduct(raw, 'pack-heineken-6un')
    expect(product.quantity).toBe(6)
  })

  it('quantity=2 for Bipack in name', () => {
    const raw = makePdpResponse({
      items: [
        {
          name: 'Bipack Vino Gato 750ml',
          price: 4990,
          listPrice: 5990,
          images: [],
        },
      ],
      specifications: [],
    })
    const product = spider._formatProduct(raw, 'bipack-vino-gato')
    expect(product.quantity).toBe(2)
  })

  it('throws when items array is empty (missing required name)', () => {
    const raw = makePdpResponse({ items: [] })
    expect(() => spider._formatProduct(raw, 'some-slug')).toThrow()
  })

  it('throws when name is missing from item', () => {
    const raw = makePdpResponse({
      items: [{ price: 1000, listPrice: 1500, images: [] }],
    })
    expect(() => spider._formatProduct(raw, 'some-slug')).toThrow()
  })

  it('uses slug from second argument when data slug differs', () => {
    const raw = makePdpResponse({ slug: 'other-slug' })
    const product = spider._formatProduct(raw, 'explicit-slug')
    expect(product.url).toBe('https://www.jumbo.cl/explicit-slug/p')
  })

  it('uses data.slug when no arg slug provided', () => {
    const raw = makePdpResponse({ slug: 'data-slug' })
    const product = spider._formatProduct(raw)
    expect(product.url).toBe('https://www.jumbo.cl/data-slug/p')
  })

  it('sets imageUrl to undefined when images array is empty', () => {
    const raw = makePdpResponse({
      items: [{ name: 'Test', price: 1000, listPrice: 1500, images: [] }],
    })
    const product = spider._formatProduct(raw, 'test-slug')
    expect(product.imageUrl).toBeUndefined()
  })

  it('falls back to category[0] when only one categoryName exists', () => {
    const raw = makePdpResponse({ categoryNames: ['Vinos'] })
    const product = spider._formatProduct(raw, 'vino')
    expect(product.category).toBe('Vinos')
  })

  it('extracts abv from product name when no spec', () => {
    const raw = makePdpResponse({
      items: [
        {
          name: 'Cerveza 5° 500ml',
          price: 1500,
          listPrice: 1800,
          images: [],
        },
      ],
      specifications: [],
    })
    const product = spider._formatProduct(raw, 'cerveza-5')
    expect(product.abv).toBe(5)
  })

  it('extracts abv from Grado spec with degree symbol', () => {
    const raw = makePdpResponse({
      items: [
        {
          name: 'Vino tinto',
          price: 3000,
          listPrice: 4000,
          images: [],
        },
      ],
      specifications: [{ key: 'Grado', value: ['13.5°'] }],
    })
    const product = spider._formatProduct(raw, 'vino-tinto')
    expect(product.abv).toBe(13.5)
  })

  it('does NOT extract abv from Grado spec with category prefix like "Bajo (<5%ABV)"', () => {
    const raw = makePdpResponse({
      items: [
        {
          name: 'Cerveza light',
          price: 1000,
          listPrice: 1200,
          images: [],
        },
      ],
      specifications: [{ key: 'Grado', value: ['Bajo (<5%ABV)'] }],
    })
    const product = spider._formatProduct(raw, 'cerveza-light')
    // The pattern (?<![<>])(\d+(?:\.\d+)?)[°%] should NOT match "<5%"
    expect(product.abv).toBeUndefined()
  })
})

describe('JumboSpider._getPagesForCategory', () => {
  const plpUrl = 'https://api.jumbo.cl/plp'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array when fetch returns null', async () => {
    const spider = new JumboSpider(makeConfig())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => null }))
    const pages = await spider._getPagesForCategory('cervezas')
    expect(pages).toEqual([])
  })

  it('fetches page 0, reads total, returns offset ranges', async () => {
    const spider = new JumboSpider(makeConfig({ page_size: 50 }))
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: 120, products: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const pages = await spider._getPagesForCategory('cervezas')

    // 120 products / 50 per page = 3 pages (ceil)
    expect(pages).toHaveLength(3)
    expect(pages[0]).toEqual({ page: '0:49', categoryUrl: 'cervezas' })
    expect(pages[1]).toEqual({ page: '50:99', categoryUrl: 'cervezas' })
    expect(pages[2]).toEqual({ page: '100:149', categoryUrl: 'cervezas' })

    // Should have called fetch once (for page 0 probe)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toBe(plpUrl)
    const body = JSON.parse(callArgs[1].body)
    expect(body.from).toBe(0)
    expect(body.to).toBe(49)
    expect(body.selectedFacets).toEqual([{ key: 'category2', value: 'cervezas' }])
  })

  it('returns one page when total equals page_size exactly', async () => {
    const spider = new JumboSpider(makeConfig({ page_size: 50 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: 50, products: [] }),
    }))

    const pages = await spider._getPagesForCategory('vinos')
    expect(pages).toHaveLength(1)
    expect(pages[0]).toEqual({ page: '0:49', categoryUrl: 'vinos' })
  })

  it('returns empty array when results is 0', async () => {
    const spider = new JumboSpider(makeConfig())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: 0, products: [] }),
    }))

    const pages = await spider._getPagesForCategory('destilados')
    expect(pages).toEqual([])
  })
})

describe('JumboSpider._getProductsFromPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches PLP with correct offset and extracts slugs', async () => {
    const spider = new JumboSpider(makeConfig())
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: 2,
        products: [
          { slug: 'cerveza-abc-500ml' },
          { slug: 'cerveza-xyz-330ml' },
          { slug: undefined }, // should be filtered out
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const slugRecords = await spider._getProductsFromPage('50:99', 'cervezas')

    // Returns slug records cast as ScrapedProduct[]
    expect(slugRecords).toHaveLength(2)
    const records = slugRecords as unknown as Array<{ slug: string }>
    expect(records[0].slug).toBe('cerveza-abc-500ml')
    expect(records[1].slug).toBe('cerveza-xyz-330ml')

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.from).toBe(50)
    expect(body.to).toBe(99)
  })

  it('returns empty array when fetch fails', async () => {
    const spider = new JumboSpider(makeConfig())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await spider._getProductsFromPage('0:49', 'cervezas')
    expect(result).toEqual([])
  })
})
