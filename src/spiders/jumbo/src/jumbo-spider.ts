import type { IScrapedProduct } from '@rdc/spider'
import { BaseSpider, JsonFetcher, ProxyFetcher } from '@rdc/spider'
import type { IJumboConfig, IJumboRawProduct, IJumboSpec } from './types'

export class JumboSpider extends BaseSpider<IScrapedProduct> {
    private readonly cfg: IJumboConfig

    constructor(config: Record<string, unknown>) {
        super(config)
        this.cfg = config as unknown as IJumboConfig
    }

    protected setupFetchers(): void {
        this.fetchers['json'] = new JsonFetcher()
        this.fetchers['proxy'] = new ProxyFetcher(process.env.PROXY_ENDPOINT ?? '', process.env.PROXY_API_KEY ?? '')
    }

    protected async scrapeCategory(categoryUrl: string): Promise<IScrapedProduct[]> {
        const pageRanges = await this.getPageRanges(categoryUrl)
        const slugLists = await Promise.all(pageRanges.map((range) => this.getSlugsForRange(range, categoryUrl)))
        const slugs = slugLists.flat()

        const products = await Promise.all(slugs.map((slug) => this.fetchAndFormatProduct(slug)))
        console.log(`[JumboSpider] ${products.filter((p): p is IScrapedProduct => p === null).length} products not scraped (${categoryUrl})`)
        return products.filter((p): p is IScrapedProduct => p !== null)
    }

    private buildPlpBody(categoryUrl: string, from: number, to: number): unknown {
        return {
            brands: [],
            collections: [],
            fullText: '',
            hideUnavailableItems: true,
            orderBy: 'OrderByBestDiscountDESC',
            selectedFacets: [{ key: 'category2', value: categoryUrl }],
            from,
            to,
            store: this.cfg.store,
        }
    }

    private async getPageRanges(categoryUrl: string): Promise<string[]> {
        const pageSize = this.cfg.page_size ?? 50
        const data = (await this.fetchers['json'].fetch(this.cfg.product_list_url, {
            method: 'POST',
            headers: this.cfg.headers,
            body: this.buildPlpBody(categoryUrl, 0, pageSize - 1),
        })) as { results?: number } | null

        if (!data?.results) return []

        const numPages = Math.ceil(data.results / pageSize)
        return Array.from({ length: numPages }, (_, i) => {
            const from = i * pageSize
            const to = from + pageSize - 1
            return `${from}:${to}`
        })
    }

    private async getSlugsForRange(range: string, categoryUrl: string): Promise<string[]> {
        const [fromStr, toStr] = range.split(':')
        const from = parseInt(fromStr, 10)
        const to = parseInt(toStr, 10)

        const data = (await this.fetchers['json'].fetch(this.cfg.product_list_url, {
            method: 'POST',
            headers: this.cfg.headers,
            body: this.buildPlpBody(categoryUrl, from, to),
        })) as { products?: Array<{ slug: string }> } | null

        return (data?.products ?? []).map((p) => p.slug).filter(Boolean)
    }

    private async fetchAndFormatProduct(slug: string): Promise<IScrapedProduct | null> {
        let data: IJumboRawProduct | null = null

        data = (await this.fetchers['json'].fetch(this.cfg.product_details_url, {
            method: 'POST',
            headers: this.cfg.headers,
            body: { store: this.cfg.store, slug },
        })) as IJumboRawProduct | null

        if (!data) {
            data = (await this.fetchers['proxy'].fetch(this.cfg.product_details_url, {
                method: 'POST',
                headers: this.cfg.headers,
                body: { store: this.cfg.store, slug },
            })) as IJumboRawProduct | null
        }

        if (!data) return null
        return this.formatProduct(slug, data)
    }

    private formatProduct(slug: string, raw: IJumboRawProduct): IScrapedProduct | null {
        const item = raw.items?.[0]
        if (!item) return null

        const url = `${this.cfg.product_url.prefix}${slug}${this.cfg.product_url.postfix}`
        const category = raw.categoryNames?.[1] ?? raw.categoryNames?.[0]

        return {
            name: item.name,
            brand: raw.brand,
            sku: raw.reference,
            price: Math.round(item.listPrice),
            best_price: Math.round(item.price),
            image_url: this.extractImageUrl(item.images?.[0]),
            category,
            url,
            source: this.cfg.source,
            scraped_at: new Date().toISOString(),
            abv: this.extractAbv(raw.specifications, item.name),
            volume_ml: this.extractVolume(item.name),
            quantity: this.extractQuantity(raw.specifications, item.name),
            packaging: this.extractPackaging(raw.specifications, item.name, category),
        }
    }

    private extractImageUrl(rawUrl?: string): string | undefined {
        if (!rawUrl) return undefined
        // VTEX CDN: /arquivos/ids/{id}-{width}-{height}/{filename} → /arquivos/ids/{id}/{filename}
        return rawUrl.replace(/(\/ids\/\d+)-\d+-\d+\//, '$1/')
    }

    private findSpec(specs: IJumboSpec[], keyword: string): string | undefined {
        const kw = keyword.toLowerCase()
        return specs.find((s) => s.key.toLowerCase().includes(kw))?.value?.[0]
    }

    private extractAbv(specs: IJumboSpec[], name: string): number | undefined {
        const specValue = this.findSpec(specs, 'graduacion')
        if (specValue && !/<|>/.test(specValue)) {
            const m = specValue.match(/(\d+(?:\.\d+)?)[°%]/)
            if (m) return parseFloat(m[1])
        }
        const m = name.match(/(\d+(?:\.\d+)?)\s*°/)
        return m ? parseFloat(m[1]) : undefined
    }

    private extractVolume(name: string): number | undefined {
        const m = name.match(/(\d+(?:\.\d+)?)\s*(cc|ml|l)\b/i)
        if (!m) return undefined
        const value = parseFloat(m[1])
        const unit = m[2].toLowerCase()
        if (unit === 'l') return Math.round(value * 1000)
        return Math.round(value) // cc ≈ ml
    }

    private extractQuantity(specs: IJumboSpec[], name: string): number {
        const nameLower = name.toLowerCase()
        if (nameLower.includes('bipack')) return 2
        if (nameLower.includes('pack')) {
            const specValue = this.findSpec(specs, 'cantidad')
            if (specValue) {
                const n = parseInt(specValue, 10)
                if (!isNaN(n)) return n
            }
            const m = name.match(/(\d+)\s*un/i)
            if (m) return parseInt(m[1], 10)
        }
        return 1
    }

    private extractPackaging(specs: IJumboSpec[], name: string, category?: string): string {
        const categoryLower = (category ?? '').toLowerCase()
        if (categoryLower.includes('destilados')) {
            return 'Botella'
        }

        const specValue = this.findSpec(specs, 'envase')
        if (specValue) {
            const v = specValue.toLowerCase()
            if (v.includes('lata')) return 'Lata'
            if (v.includes('barril')) return 'Barril'
            if (v.includes('tetrapack') || v.includes('tetra') || v.includes('caja')) return 'Tetrapack'
            if (v.includes('botella')) return 'Botella'
        }

        const nameLower = name.toLowerCase()
        if (nameLower.includes('lata')) return 'Lata'
        if (nameLower.includes('barril')) return 'Barril'
        if (nameLower.includes('tetrapack') || nameLower.includes('caja')) return 'Tetrapack'
        return 'Botella'
    }
}
