
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
