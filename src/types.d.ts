import { Document, Types } from 'mongoose'

// Scraper types
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

// API responses
export interface Drink {
  _id: Types.ObjectId
  name: string
  brand: string
  alcoholic_grade: number
  content: number
  package: string
  category: string
  sub_category: string
  made_in?: string
  variety?: string
  bitterness?: string
  strain?: string
  vineyard?: string
}

// Mongoose models
export interface ProductUnit extends Document {
  name: string
  brand: string
  alcoholic_grade: number
  content: number
  package: string
  category: string
  sub_category: string
  made_in?: string
  variety?: string
  bitterness?: string
  strain?: string
  vineyard?: string
}

export interface Website {
  name: string
  logo: string
  url: string
  price: number
  best_price: number
  average: number
  watch: number
}

export interface Product extends Document {
  title: string
  quantity: number
  image_url: string
  product: ProductUnit
  websites: Types.DocumentArray<Website>
}
