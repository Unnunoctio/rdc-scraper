import { Date } from 'mongoose'

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
  info: Info
  path: string
  price: number
  best_price: number
  average: number
  last_update: number
  in_stock: boolean
  records: Record[]
}

export interface Product {
  sku: number
  quantity: number
  images: Image
  drink: Drink
  websites: Website[]
}
