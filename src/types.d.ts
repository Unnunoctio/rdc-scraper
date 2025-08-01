
// BD
export interface DrinkDB extends Drink {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface InfoDB extends Info {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface ImageDB extends Image {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PriceLogDB extends PriceLog {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface WebsiteDB extends Website {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductDB extends Product {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

// INTERFACE
export interface Drink {
  drinkId: string
  name: string
  brand: string
  abv: number
  volume: number
  packaging: string
  category: string
  subCategory: string
  origin: string
  variety?: string
  ibu?: number
  servingTemp?: string
  strain?: string
  vineyard?: string
}

export interface Info {
  name: string
  logo: string
}

export interface Image {
  small: string
  large: string
}

export interface PriceLog {
  price: number
  date: Date
}

export interface Website {
  info: string
  path: string
  price: number
  bestPrice: number
  average: number | null
  lastUpdate: string
  inStock: boolean
  priceLogs: string[]
}

export interface Product {
  sku: string
  quantity: number
  images: string
  drink: string
  websites: string[]
}

// API
export interface DrinksApiResponse {
  status: boolean
  data: DrinkApi[]
  error: any
  meta: {
    timestamp: string
    version: string
    pagination: {
      page: number
      limit: number
      totalPages: number
      totalItems: number
    }
  }
}

export interface DrinkApi {
  _id?: string
  name: string
  brand: string
  abv: number
  volume: number
  packaging: string
  category: string
  subCategory: string
  origin: string
  variety?: string
  ibu?: number
  servingTemp?: string
  strain?: string
  vineyard?: string
}

// FILES
export interface ExcelFile {
  filename: string
  content: Buffer
}
