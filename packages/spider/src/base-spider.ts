import type { ScrapedProduct } from './standard-format'
import type { IFetcher } from './fetchers'

export abstract class BaseSpider {
  protected config: Record<string, unknown>
  protected fetchers: Map<string, IFetcher> = new Map()

  constructor(config: Record<string, unknown>) {
    this.config = config
    this._setupFetchers()
  }

  async run(): Promise<ScrapedProduct[]> {
    const categoryUrls = this.config['category_urls'] as string[]
    const allPages = await Promise.all(categoryUrls.map(url => this._getPagesForCategory(url)))
    const products = await Promise.all(
      allPages.flat().map(({ page, categoryUrl }) => this._getProductsFromPage(page, categoryUrl))
    )
    return this._deduplicate(products.flat())
  }

  protected fetch(name: string): IFetcher {
    const fetcher = this.fetchers.get(name)
    if (!fetcher) throw new Error(`Fetcher "${name}" not registered`)
    return fetcher
  }

  protected _deduplicate(products: ScrapedProduct[]): ScrapedProduct[] {
    const seen = new Set<string>()
    return products.filter(p => {
      if (seen.has(p.url)) return false
      seen.add(p.url)
      return true
    })
  }

  protected abstract _setupFetchers(): void
  protected abstract _getPagesForCategory(categoryUrl: string): Promise<Array<{ page: unknown; categoryUrl: string }>>
  protected abstract _getProductsFromPage(page: unknown, categoryUrl: string): Promise<ScrapedProduct[]>
  protected abstract _formatProduct(raw: unknown, ...args: unknown[]): ScrapedProduct
}
