import { Info, Scraper, UpdateWebsite } from '../types'

// SPIDER
export interface Spider {
  info: Info
  headers: { [key: string]: string }
  start_urls: string[]

  run: (paths: string[]) => Promise<[UpdateWebsite[], Scraper[]]>
}

// JUMBO
export interface JumboResponse {
  redirect: null
  products: JumboProduct[]
  recordsFiltered: number
  operator: string
}

export interface JumboProduct {
  productId: string
  productName: string
  brand: string
  categories: string[]
  linkText: string
  items: JumboItem[]
  'Graduación Alcohólica'?: string[]
  Grado?: string[]
  Envase?: string[]
  Cantidad?: string[]
  Contenido?: string[]
}

export interface JumboItem {
  images: JumboImage[]
  sellers: JumboSeller[]
}

export interface JumboImage {
  imageUrl: string
  imageTag: string
}

export interface JumboSeller {
  commertialOffer: {
    Price: number
    ListPrice: number
    PriceWithoutDiscount: number
    AvailableQuantity: number
  }
}

export interface JumboAverage {
  average: number
  totalCount: number
  id: string
}
