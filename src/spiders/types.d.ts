import { ScraperClass } from '../classes/ScraperClass'
import { UpdaterClass } from '../classes/UpdaterClass'
import { Info } from '../types'

// SPIDER
export interface Spider {
  info: Info
  headers: { [key: string]: string }
  start_urls: string[]

  run: (paths: string[]) => Promise<[UpdaterClass[], ScraperClass[]]>
}

// CENCOSUD (Jumbo y Santa Isabel)
export interface CencosudResponse {
  redirect: null
  products: CencosudProduct[]
  recordsFiltered: number
  operator: string
}

export interface CencosudProduct {
  productId: string
  productName: string
  brand: string
  categories: string[]
  linkText: string
  items: CencosudItem[]
  'Graduación Alcohólica'?: string[]
  Grado?: string[]
  Envase?: string[]
  Cantidad?: string[]
  Contenido?: string[]
}

export interface CencosudItem {
  images: CencosudImage[]
  sellers: CencosudSeller[]
}

export interface CencosudImage {
  imageUrl: string
  imageTag: string
}

export interface CencosudSeller {
  commertialOffer: {
    Price: number
    ListPrice: number
    PriceWithoutDiscount: number
    AvailableQuantity: number
  }
}

export interface CencosudAverage {
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
