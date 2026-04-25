export interface ScrapedProduct {
  name: string
  price: number
  bestPrice: number
  url: string
  source: string
  brand?: string
  imageUrl?: string
  volumeMl?: number
  abv?: number
  category?: string
  sku?: string
  quantity?: number
  packaging?: string
}

export function isComplete(product: ScrapedProduct): boolean {
  return !!(product.brand && product.volumeMl && product.abv && product.packaging)
}
