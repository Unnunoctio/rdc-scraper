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

// SANTA
export interface SantaResponse {
  redirect: null
  products: SantaProduct[]
  recordsFiltered: number
  operator: string
}

export interface SantaProduct {
  productId: string
  productName: string
  brand: string
  categories: string[]
  linkText: string
  items: SantaItem[]
  'Graduación Alcohólica'?: string[]
  Grado?: string[]
  Envase?: string[]
  Cantidad?: string[]
  Contenido?: string[]
}

export interface SantaItem {
  images: SantaImage[]
  sellers: SantaSeller[]
}

export interface SantaImage {
  imageUrl: string
  imageTag: string
}

export interface SantaSeller {
  commertialOffer: {
    Price: number
    ListPrice: number
    PriceWithoutDiscount: number
    AvailableQuantity: number
  }
}

export interface SantaAverage {
  average: number
  totalCount: number
  id: string
}

// LIDER
export interface LiderResponse {
  products: LiderProduct[]
  nbPages: number
}

export interface LiderProduct {
  sku: string
  brand: string
  displayName: string
  images: LiderImages
  specifications: LiderSpecification[]
  price: LiderPrice
  categorias: string[]
  available: boolean
}

export interface LiderImages {
  defaultImage: string
  smallImage: string
  mediumImage: string
  largeImage: string
}

export interface LiderSpecification {
  name: string
  value: string
}

export interface LiderPrice {
  BasePriceReference: number
  BasePriceSales: number
}

export interface LiderBody {
  categories: string
  page: number
  facets: string[]
  sortBy: string
  hitsPerPage: number
}
