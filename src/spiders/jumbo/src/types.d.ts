export interface IJumboConfig {
    source: string
    product_list_url: string
    product_details_url: string
    product_url: { prefix: string; postfix: string }
    page_size: number
    store: string
    category_urls: string[]
    headers: Record<string, string>
}

export interface IJumboSpec {
    key: string
    value: string[]
}

export interface IJumboItem {
    name: string
    price: number
    listPrice: number
    images: string[]
}

export interface IJumboRawProduct {
    items: IJumboItem[]
    brand: string
    reference: string
    categoryNames: string[]
    specifications: IJumboSpec[]
}

export interface IJumboHandlerEvent {
    config: IJumboConfig
    execution_id: string
}

export interface IJumboHandlerResult {
    s3_key: string
    count: number
    error?: string
}
