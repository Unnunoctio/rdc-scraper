import { Date, ObjectId, Document } from 'mongoose'

// BASE DE DATOS
export interface DrinkDB extends Drink, Document {}

export interface ImageDB extends Image, Document {}

export interface InfoDB extends Info, Document {}

export interface RecordDB extends Record, Document {}

export interface WebsiteDB extends Website, Document {}

export interface ProductDB extends Product, Document {}

// INTERFACE
export interface Drink {
  name: string
  brand: string
  alcoholic_grade: number
  content: number
  package: string
  category: string
  sub_category: string
  made_in: string
  variety?: string
  bitterness?: number
  temperature?: string
  strain?: string
  vineyard?: string
}

export interface Image {
  small: string
  large: string
}

export interface Info {
  name: string
  url: string
  logo: string
}

export interface Record {
  price: number
  date: Date
}

export interface Website {
  info: ObjectId
  path: string
  price: number
  best_price: number
  average: number | null
  last_update: number
  in_stock: boolean
  records: ObjectId[]
}

export interface Product {
  sku: number
  quantity: number
  images: ObjectId
  drink: ObjectId
  websites: ObjectId[]
}

// SPIDER
export interface Spider {
  info: Info
  headers: { [key: string]: string }
  start_urls: string[]

  run: () => Promise<Scraper[]>
}

export interface Scraper {
  product_sku: any
  title: string
  brand: string
  category: string
  url: string
  price: number
  best_price: number
  average?: number | null
  images?: Image
  alcoholic_grade?: number
  content?: number
  quantity?: number
  package?: string
}
