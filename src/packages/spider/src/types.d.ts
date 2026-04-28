export interface IScrapedProduct {
    name: string
    price: number
    best_price: number
    url: string
    source: string
    scraped_at: string
    brand?: string
    image_url?: string
    volume_ml?: number
    abv?: number
    category?: string
    sku?: string
    quantity?: number
    packaging?: string
}

export interface IFetchOptions {
    method?: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: unknown
}

export interface IFetcher {
    fetch(url: string, options?: IFetchOptions): Promise<unknown>
}

export interface IFieldConfig {
    paths: string[]
    type?: 'string' | 'int' | 'float'
    prefix?: string
    suffix?: string
}
