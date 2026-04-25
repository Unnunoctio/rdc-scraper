import { BaseSpider, JsonFetcher } from '@rdc/spider'
import type { ScrapedProduct } from '@rdc/spider'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function specValue(specs: Array<{ key: string; value: string[] }>, ...keys: string[]): string | undefined {
  const normalizedKeys = keys.map(normalize)
  for (const spec of specs) {
    if (normalizedKeys.includes(normalize(spec.key ?? ''))) {
      return spec.value?.[0]
    }
  }
  return undefined
}

function extractAbv(specs: Array<{ key: string; value: string[] }>, name: string): number | undefined {
  // 1. Spec "Graduacion Alcoholica"
  const raw1 = specValue(specs, 'Graduacion Alcoholica')
  if (raw1) {
    const m = raw1.match(/(\d+(?:\.\d+)?)/)
    if (m) return parseFloat(m[1])
  }

  // 2. Product name pattern "4.5°"
  const m2 = name.match(/(\d+(?:\.\d+)?)°/)
  if (m2) return parseFloat(m2[1])

  // 3. Spec "Grado" — only numeric values like "4.5°" or "4.5%"
  const raw3 = specValue(specs, 'Grado')
  if (raw3) {
    const m = raw3.match(/(?<![<>])(\d+(?:\.\d+)?)[°%]/)
    if (m) return parseFloat(m[1])
  }

  return undefined
}

function extractVolumeMl(name: string): number | undefined {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(cc|ml|l)\b/i)
  if (!m) return undefined
  const amount = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  return unit === 'l' ? Math.round(amount * 1000) : Math.round(amount)
}

function extractQuantity(specs: Array<{ key: string; value: string[] }>, name: string): number {
  if (name.includes('Pack')) {
    const raw = specValue(specs, 'Cantidad')
    if (raw) {
      const m = raw.match(/(\d+)/)
      if (m) return parseInt(m[1], 10)
    }
    const m2 = name.match(/(\d+)\s*un\./i)
    if (m2) return parseInt(m2[1], 10)
  }
  if (name.includes('Bipack')) return 2
  return 1
}

function extractPackaging(
  specs: Array<{ key: string; value: string[] }>,
  name: string,
  category: string | undefined,
): string | undefined {
  if (category && normalize(category) === 'destilados') return 'Botella'

  const raw = specValue(specs, 'Envase')
  if (raw) {
    const envase = raw.toLowerCase()
    if (envase.includes('botella')) return 'Botella'
    if (envase.includes('lata')) return 'Lata'
    if (envase.includes('barril')) return 'Barril'
    if (envase.includes('tetrapack') || envase.includes('tetra')) return 'Tetrapack'
    if (envase.includes('caja')) {
      if (category && normalize(category) === 'vinos') return 'Tetrapack'
    }
  }

  const nameLower = name.toLowerCase()
  if (nameLower.includes('botella')) return 'Botella'
  if (nameLower.includes('lata')) return 'Lata'
  if (nameLower.includes('barril')) return 'Barril'
  if (nameLower.includes('tetrapack') || nameLower.includes('caja')) return 'Tetrapack'

  return undefined
}

interface JumboPlpResponse {
  results?: number
  products?: Array<{ slug?: string }>
}

interface JumboItem {
  name?: string
  price?: number
  listPrice?: number
  images?: string[]
}

interface JumboSpec {
  key: string
  value: string[]
}

interface JumboPdpResponse {
  items?: JumboItem[]
  brand?: string
  reference?: string
  categoryNames?: string[]
  slug?: string
  specifications?: JumboSpec[]
}

export class JumboSpider extends BaseSpider {
  private get _source(): string {
    return (this.config['source'] as string | undefined) ?? 'jumbo'
  }

  private get _productListUrl(): string {
    return (this.config['product_list_url'] as string | undefined) ?? ''
  }

  private get _productDetailsUrl(): string {
    return (this.config['product_details_url'] as string | undefined) ?? ''
  }

  private get _productUrl(): { prefix: string; postfix: string } {
    const cfg = this.config['product_url'] as { prefix?: string; postfix?: string } | undefined
    return {
      prefix: cfg?.prefix ?? 'https://www.jumbo.cl/',
      postfix: cfg?.postfix ?? '/p',
    }
  }

  private get _pageSize(): number {
    return parseInt(String(this.config['page_size'] ?? 50), 10)
  }

  private get _store(): string {
    return (this.config['store'] as string | undefined) ?? 'jumbo'
  }

  private get _headers(): Record<string, string> {
    return (this.config['headers'] as Record<string, string> | undefined) ?? {}
  }

  _setupFetchers(): void {
    this.fetchers.set('json', new JsonFetcher())
  }

  private _buildProductUrl(slug: string): string {
    return `${this._productUrl.prefix}${slug}${this._productUrl.postfix}`
  }

  private _buildPlpBody(categoryUrl: string, fromOffset: number, toOffset: number): unknown {
    return {
      brands: [],
      collections: [],
      fullText: '',
      hideUnavailableItems: true,
      promotionalCards: true,
      sponsoredProducts: true,
      orderBy: 'OrderByBestDiscountDESC',
      selectedFacets: [{ key: 'category2', value: categoryUrl }],
      from: fromOffset,
      to: toOffset,
      store: this._store,
    }
  }

  private _buildPdpBody(slug: string): unknown {
    return { store: this._store, slug }
  }

  async _getPagesForCategory(categoryUrl: string): Promise<Array<{ page: unknown; categoryUrl: string }>> {
    const body = this._buildPlpBody(categoryUrl, 0, this._pageSize - 1)
    const fetcher = this.fetch('json') as JsonFetcher
    const data = (await fetcher.post(this._productListUrl, body, { headers: this._headers })) as JumboPlpResponse | null
    if (!data) return []

    const total = data.results ?? 0
    const numPages = Math.ceil(total / this._pageSize)

    return Array.from({ length: numPages }, (_, i) => ({
      page: `${i * this._pageSize}:${(i + 1) * this._pageSize - 1}`,
      categoryUrl,
    }))
  }

  // Fetches slugs from a PLP page, then fetches PDP details for each slug
  async _getProductsFromPage(page: unknown, categoryUrl: string): Promise<ScrapedProduct[]> {
    const [fromOffset, toOffset] = (page as string).split(':').map(Number)
    const body = this._buildPlpBody(categoryUrl, fromOffset, toOffset)
    const fetcher = this.fetch('json') as JsonFetcher
    const data = (await fetcher.post(this._productListUrl, body, { headers: this._headers })) as JumboPlpResponse | null
    if (!data) return []

    const slugs = (data.products ?? [])
      .map(p => p.slug)
      .filter((s): s is string => !!s)

    const results = await Promise.all(slugs.map(slug => this._fetchDetail(slug)))
    return results.filter((p): p is ScrapedProduct => p !== null)
  }

  private async _fetchDetail(slug: string): Promise<ScrapedProduct | null> {
    const body = this._buildPdpBody(slug)
    const fetcher = this.fetch('json') as JsonFetcher
    const data = (await fetcher.post(this._productDetailsUrl, body, { headers: this._headers })) as JumboPdpResponse | null
    if (!data) return null
    try {
      return this._formatProduct(data, slug)
    } catch {
      return null
    }
  }

  _formatProduct(raw: unknown, ...args: unknown[]): ScrapedProduct {
    const data = raw as JumboPdpResponse
    const slug = (args[0] as string | undefined) ?? data.slug ?? ''

    const item = data.items?.[0] as JumboItem | undefined
    if (!item) throw new Error('No items in PDP response')

    const name = item.name
    if (!name) throw new Error('Missing name')

    const bestPrice = item.price ?? 0
    const price = item.listPrice ?? 0

    if (!price && !bestPrice) throw new Error('Missing price')

    const url = this._buildProductUrl(slug)
    if (!url) throw new Error('Missing url')

    const brand = data.brand ?? undefined
    const skuVal = data.reference

    const images = item.images ?? []
    let imageUrl: string | undefined
    if (images.length > 0) {
      imageUrl = images[0].replace(/\/ids\/(\d+)-\d+-\d+\//, '/ids/$1/')
    }

    const categoryNames = data.categoryNames ?? []
    const category =
      categoryNames.length > 1
        ? categoryNames[1]
        : categoryNames.length > 0
          ? categoryNames[0]
          : undefined

    const specs = (data.specifications ?? []) as JumboSpec[]

    const abv = extractAbv(specs, name)
    const volumeMl = extractVolumeMl(name)
    const quantity = extractQuantity(specs, name)
    const packaging = extractPackaging(specs, name, category)

    return {
      name,
      price: price ?? bestPrice,
      bestPrice: bestPrice ?? price,
      url,
      source: this._source,
      brand: brand || undefined,
      imageUrl,
      volumeMl,
      abv,
      category,
      sku: skuVal,
      quantity,
      packaging,
    }
  }
}
