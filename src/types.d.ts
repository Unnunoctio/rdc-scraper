import { ObjectId } from 'mongodb'

// Base de Datos
export interface DrinkDB extends Drink {
  _id: ObjectId
}

export interface ImageDB extends Image {
  _id: ObjectId
}

export interface InfoDB extends Info {
  _id: ObjectId
}

export interface RecordDB extends Record {
  _id: ObjectId
}

export interface WebsiteDB extends Website {
  _id: ObjectId
}

export interface ProductDB extends Product {
  _id: ObjectId
}

// Interface
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
