import axios from 'axios'
import { Info, Scraper, Spider } from '../types'

interface LiderResponse {
  products: Product[]
  nbPages: number
}

interface Product {
  sku: string
  brand: string
  displayName: string
  images: Images
  specifications: Specification[]
  price: Price
  categorias: string[]
  available: boolean
}

interface Images {
  defaultImage: string
  smallImage: string
  mediumImage: string
  largeImage: string
}

interface Specification {
  name: string
  value: string
}

interface Price {
  BasePriceReference: number
  BasePriceSales: number
}

interface Body {
  categories: string
  page: number
  facets: string[]
  sortBy: string
  hitsPerPage: number
}

export class LiderSpider implements Spider {
  info: Info = {
    name: 'Lider',
    url: 'https://www.lider.cl',
    logo: 'https://www.walmartchile.cl/wp-content/themes/walmartchile/img/favicon-32x32.png'
  }

  headers: { [key: string]: string } = {
    'X-Channel': 'SOD',
    Tenant: 'supermercado'
  }

  start_urls: string[] = [
    'https://apps.lider.cl/supermercado/bff/category'
  ]

  start_bodies: Body[] = [
    {
      categories: 'Bebidas y Licores/Cervezas',
      page: 1,
      facets: [],
      sortBy: '',
      hitsPerPage: 100
    },
    {
      categories: 'Bebidas y Licores/Destilados',
      page: 1,
      facets: [],
      sortBy: '',
      hitsPerPage: 100
    },
    {
      categories: 'Bebidas y Licores/Vinos y Espumantes',
      page: 1,
      facets: [],
      sortBy: '',
      hitsPerPage: 100
    }
  ]

  async run (): Promise<Scraper[]> {
    console.log('Running Lider Spider')
    console.time('Lider Spider')

    // Obtener todas las paginas por cada body
    const bodies = (await Promise.all(this.start_bodies.map(async (body) => {
      return await this.getBodies(body)
    }))).flat()

    // Obtener todos los productos de todos los body
    const products = (await Promise.all(bodies.map(async (body) => {
      const { data } = await axios.post<LiderResponse>(`${this.start_urls[0]}`, body, { headers: this.headers })
      return data.products
    }))).flat()

    // Obtener productos scrapeados
    const scrapedProducts = await Promise.all(products.map(async (product) => {
      if (!product.available) return undefined
      let scraped = this.getMainData(product)
      if (scraped === undefined) return undefined
      scraped = this.getExtraData(scraped, product)
      return scraped
    }))

    // Filtrar productos scrapeados correctos
    const filtered = scrapedProducts.filter((scraped) => {
      return scraped?.title !== undefined &&
             scraped.brand !== undefined &&
             scraped.category !== undefined &&
             scraped.url !== undefined &&
             scraped.price !== undefined && scraped.price !== 0 &&
             scraped.best_price !== undefined && scraped.best_price !== 0 &&
             scraped.image !== undefined &&
             scraped.alcoholic_grade !== undefined &&
             scraped.content !== undefined &&
             scraped.quantity !== undefined &&
             scraped.package !== undefined
    })

    const finalProducts = filtered.map((scraped) => {
      return {
        ...scraped,
        average: null
      }
    })
    console.timeEnd('Lider Spider')
    return finalProducts as Scraper[]
  }

  async getBodies (body: Body): Promise<Body[]> {
    const { data } = await axios.post<LiderResponse>(`${this.start_urls[0]}`, body, { headers: this.headers })

    const bodies: Body[] = []
    for (let i = 1; i <= data.nbPages; i++) {
      bodies.push({ ...body, page: i })
    }
    return bodies
  }

  getMainData (product: Product): Scraper | undefined {
    try {
      const scraped: Scraper = {
        website: this.info.name,
        product_sku: product.sku,
        title: product.displayName,
        brand: product.brand,
        category: this.getCategory(product.categorias),
        url: `/supermercado/product/sku/${product.sku}`,
        price: product.price.BasePriceReference,
        best_price: product.price.BasePriceSales
      }
      return scraped
    } catch (error) {
      console.log('Error al obtener los datos principales')
      return undefined
    }
  }

  getCategory (categories: string[]): string {
    for (const category of categories) {
      if (category.includes('Vinos')) return 'Vinos'
      if (category.includes('Cervezas')) return 'Cervezas'
      if (category.includes('Destilados')) return 'Destilados'
    }
    return ''
  }

  getExtraData (scraped: Scraper, product: Product): Scraper {
    // Images
    try {
      scraped.image = product.images.defaultImage.replace('&scale=size[180x180]', '')
    } catch (error) {
      scraped.image = undefined
      console.log('Error al obtener las imagenes')
    }

    // Quantity
    const quantity = this.getEspecification(product.specifications, 'Unidades por paquete')
    if (quantity !== undefined) {
      scraped.quantity = Number(quantity)
    }
    if (Number.isNaN(scraped.quantity)) {
      if (product.displayName.includes('Pack')) {
        const match = product.displayName.match(/Pack, (\d+)/)
        scraped.quantity = (match !== null) ? Number(match[1]) : undefined
      } else {
        scraped.quantity = 1
      }
    }

    // Alcoholic Grade
    const alcoholicGrade = this.getEspecification(product.specifications, 'Graduación alcohólica')
    if (alcoholicGrade !== undefined) {
      scraped.alcoholic_grade = Number(alcoholicGrade.replaceAll(/[^\d+(?:,\d+)?]/g, '').replaceAll(',', '.'))
    }

    // Content
    const content = this.getEspecification(product.specifications, 'Contenido neto')
    if (content !== undefined) {
      scraped.content = Number(content.split(' ')[0])
    }
    if (Number.isNaN(scraped.content)) {
      const match = product.displayName.match(/(\d+)\s*(ml|cc|L|l|c\/u)|(\d+)(ml|cc|L|l|c\/u)/)
      if (match !== null) {
        const amount = Number(match[1])
        const unit = match[2]
        scraped.content = (unit === 'l' || unit === 'L') ? amount * 1000 : amount
      }
    }

    // Package
    const packaging = this.getEspecification(product.specifications, 'Presentación')
    if (packaging !== undefined) {
      if (packaging === 'Botella' || packaging === 'Botellas') scraped.package = 'Botella'
      if (packaging === 'Lata' || packaging === 'Latas') scraped.package = 'Lata'
    }
    if (scraped.package === undefined) {
      const name = product.displayName
      if (name.includes('Botella') || name.includes('Botellas') || name.includes('Botellin')) scraped.package = 'Botella'
      if (name.includes('Lata') || name.includes('Latas')) scraped.package = 'Lata'
    }

    return scraped
  }

  getEspecification (specifications: Specification[], name: string): string | undefined {
    for (const specification of specifications) {
      if (specification.name === name) return specification.value
    }
    return undefined
  }
}
