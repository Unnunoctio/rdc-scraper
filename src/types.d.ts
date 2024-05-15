import { ObjectId } from 'mongodb'

export interface Info {
  name: string
  logo: string
}

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
