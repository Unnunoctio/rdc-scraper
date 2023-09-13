export type UrlType = `https://${string}`

export interface HeaderType { [key: string]: string }

export interface Spider {
  websiteName: string
  websiteUrl: string
  websiteLogo: string
  headers: HeaderType
  startUrls: UrlType[]
  blockedUrls?: UrlType[]
  productUrl: UrlType
  watcher: number

  run: () => Promise<ProductScraper[]>
}

export interface UpdateWebsite {
  url: string
  price: number
  best_price: number
  average: number
  watch: number
}

export interface ProductScraper {
  websiteName: string
  title: string
  brand: string
  category: string
  subCategory: string
  url: string
  imageUrl?: string
  price?: number
  bestPrice?: number
  quantity?: number
  alcoholicGrade?: number
  content?: number
  package?: string
}
