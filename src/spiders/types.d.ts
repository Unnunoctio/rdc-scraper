
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
