import type { IFetcher, IScrapedProduct } from './types'

export abstract class BaseSpider<TProduct extends Pick<IScrapedProduct, 'url'>> {
    protected fetchers: Record<string, IFetcher> = {}

    constructor(protected readonly config: Record<string, unknown>) {}

    async run(): Promise<TProduct[]> {
        this.setupFetchers()
        const categoryUrls = (this.config['category_urls'] as string[] | undefined) ?? []

        const results = await Promise.all(categoryUrls.map((url) => this.scrapeCategory(url)))
        return this.deduplicate(results.flat())
    }

    protected abstract setupFetchers(): void
    protected abstract scrapeCategory(categoryUrl: string): Promise<TProduct[]>

    protected deduplicate(products: TProduct[]): TProduct[] {
        const seen = new Set<string>()
        return products.filter((p) => {
            if (seen.has(p.url)) return false
            seen.add(p.url)
            return true
        })
    }
}
