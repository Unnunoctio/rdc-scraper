import axios from 'axios'
import { Info, Scraper, Spider } from '../types'

interface JumboResponse {
  redirect: null
  products: JumboProduct[]
  recordsFiltered: number
  operator: string
}

interface JumboProduct {
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

interface JumboItem {
  images: JumboImage[]
  sellers: JumboSeller[]
}

interface JumboImage {
  imageUrl: string
  imageTag: string
}

interface JumboSeller {
  commertialOffer: {
    Price: number
    ListPrice: number
    PriceWithoutDiscount: number
    AvailableQuantity: number
  }
}

interface JumboAverage {
  average: number
  totalCount: number
  id: string
}

export class JumboSpider implements Spider {
  info: Info = {
    name: 'Jumbo',
    url: 'https://jumbo.cl',
    logo: 'https://assets.jumbo.cl/favicon/favicon-192.png'
  }

  headers: { [key: string]: string } = {
    apiKey: 'WlVnnB7c1BblmgUPOfg'
  }

  start_urls: string[] = [
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/cervezas',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/destilados',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/vinos'
  ]

  average_url = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'

  async run (): Promise<Scraper[]> {
    console.log('Running Jumbo Spider')
    console.time('Jumbo Spider')

    // Obtener todas las paginas por cada url
    const pages = (await Promise.all(this.start_urls.map(async (url) => {
      return await this.getPages(url)
    }))).flat()

    // Obtener todos los productos de todas las paginas
    const products = (await Promise.all(pages.map(async (url) => {
      const { data } = await axios.get<JumboResponse>(`${url}`, { headers: this.headers })
      return data.products
    }))).flat()

    // Obtener productos scrapeados
    const scrapedProducts = await Promise.all(products.map(async (product) => {
      let scraped = this.getMainData(product)
      scraped = this.getExtraData(scraped, product)
      // Obtener mas data desde la pagina del producto
      return scraped
    }))

    // Filtrar productos scrapeados correctos
    const filtered = scrapedProducts.filter((scraped) => {
      return scraped.title !== undefined &&
             scraped.brand !== undefined &&
             scraped.category !== undefined &&
             scraped.url !== undefined &&
             scraped.price !== undefined && scraped.price !== 0 &&
             scraped.best_price !== undefined && scraped.best_price !== 0 &&
             scraped.images?.small !== undefined && scraped.images?.large !== undefined &&
             scraped.alcoholic_grade !== undefined &&
             scraped.content !== undefined &&
             scraped.quantity !== undefined &&
             scraped.package !== undefined
    })

    // Obtener los averages de cada producto scrapeado
    const averages = await this.getAverages(filtered)

    // Por cada producto scrapeado agregar su average
    const finalProducts = filtered.map((scraped) => {
      const average = averages?.find(a => a.id === scraped.product_sku)
      if (average !== undefined && average.totalCount !== 0) {
        return { ...scraped, average: average?.average }
      } else if (average !== undefined && average.totalCount === 0) {
        return { ...scraped, average: null }
      }
      return scraped
    })

    console.timeEnd('Jumbo Spider')
    return finalProducts
  }

  async getPages (url: string): Promise<string[]> {
    const { data } = await axios.get<JumboResponse>(`${url}?sc=11`, { headers: this.headers })
    const total = Math.ceil(data.recordsFiltered / 40)

    const pages: string[] = []
    for (let i = 1; i <= total; i++) {
      pages.push(`${url}?sc=11&page=${i}`)
    }
    return pages
  }

  getMainData (product: JumboProduct): Scraper {
    const scraped: Scraper = {
      website: this.info.name,
      product_sku: product.productId,
      title: product.productName,
      brand: product.brand,
      category: product.categories[0].split('/')[2],
      url: `/${product.linkText}/p`,
      price: product.items[0].sellers[0].commertialOffer.PriceWithoutDiscount,
      best_price: product.items[0].sellers[0].commertialOffer.Price
    }
    return scraped
  }

  getExtraData (scraped: Scraper, product: JumboProduct): Scraper {
    // Images
    try {
      const link = product.items[0].images[0].imageUrl
      const linkSplit = link.split('/')
      const linkParsed = linkSplit.slice(0, -1).join('/')

      scraped.images = {
        small: `${linkParsed}-280-280`,
        large: `${linkParsed}-750-750`
      }
    } catch (error) {
      console.log('Error al obtener las imagenes')
    }

    // Quantity
    if (product.productName.includes('Pack')) {
      if (product.Cantidad !== undefined) {
        const match = product.Cantidad[0].match(/^(\d+)/)
        scraped.quantity = (match != null) ? Number(match[0]) : undefined
      }
      if (scraped.quantity === undefined) {
        const match = product.productName.match(/(\d+)\s*un\./i)
        scraped.quantity = (match != null) ? Number(match[1]) : undefined
      }
    } else if (product.productName.includes('Bipack')) {
      scraped.quantity = 2
    } else {
      scraped.quantity = 1
    }

    // Extra verfify quatity
    if (scraped.quantity !== undefined && scraped.quantity > 12 && scraped.category === 'Destilados') {
      scraped.quantity = 1
    }

    // Alcoholic Grade
    if (product['Graduación Alcohólica'] !== undefined) {
      const match = product['Graduación Alcohólica'][0].match(/(\d+(?:\.\d+)?)°/)
      scraped.alcoholic_grade = (match != null) ? Number(match[1]) : undefined
    } else if (product.Grado !== undefined) {
      const match = product.Grado[0].match(/(\d+(?:\.\d+)?)°/)
      scraped.alcoholic_grade = (match != null) ? Number(match[1]) : undefined
    }
    if (product.productName.includes('°') && scraped.alcoholic_grade === undefined) {
      const match = product.productName.match(/(\d+(?:\.\d+)?)°/)
      scraped.alcoholic_grade = (match != null) ? Number(match[1]) : undefined
    }

    // Content
    if (product.Contenido !== undefined) {
      const match = product.Contenido[0].match(/(\d+(\.\d+)?)\s*(cc|ml|L|l|litro|litros?)/i)
      if (match !== null) {
        const amount = Number(match[1])
        const unit = match[3].toLowerCase()
        scraped.content = (unit === 'l' || unit === 'litro' || unit === 'litros') ? amount * 1000 : amount
      }
    }
    if (scraped.content === undefined) {
      const match = product.productName.match(/(\d+(?:\.\d+)?) (cc|L)/i)
      if (match !== null) {
        const amount = Number(match[1])
        const unit = match[2].toLowerCase()
        scraped.content = (unit === 'l') ? amount * 1000 : amount
      }
    }

    // Package
    // Package Default Destilados
    if (scraped.category === 'Destilados') scraped.package = 'Botella'

    if (product.Envase !== undefined) {
      if (product.Envase[0].includes('Botella')) {
        scraped.package = 'Botella'
      } else if (product.Envase[0].includes('Lata')) {
        scraped.package = 'Lata'
      } else if (product.Envase[0].includes('Barril')) {
        scraped.package = 'Barril'
      } else if (product.Envase[0].includes('Tetrapack')) {
        scraped.package = 'Tetrapack'
      } else if (product.Envase[0].includes('Caja') && scraped.category === 'Destilados') {
        scraped.package = 'Botella'
      } else if (product.Envase[0].includes('Caja') && scraped.category === 'Vinos') {
        scraped.package = 'Tetrapack'
      }
    }
    if (scraped.package === undefined) {
      const titleLower = product.productName.toLowerCase()
      if (titleLower.includes('botella')) {
        scraped.package = 'Botella'
      } else if (titleLower.includes('lata')) {
        scraped.package = 'Lata'
      } else if (titleLower.includes('barril')) {
        scraped.package = 'Barril'
      } else if (titleLower.includes('tetrapack') || titleLower.includes('caja')) {
        scraped.package = 'Tetrapack'
      }
    }

    return scraped
  }

  async getAverages (products: Scraper[]): Promise<JumboAverage[] | undefined> {
    const skus = products.map((product) => product.product_sku).join(',')
    try {
      const { data } = await axios<JumboAverage[]>(`${this.average_url}?ids=${skus}`, { headers: this.headers })
      return data
    } catch (error) {
      console.log('Error al obtener los averages')
      return undefined
    }
  }
}
