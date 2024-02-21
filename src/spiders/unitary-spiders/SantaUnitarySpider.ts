import axios from 'axios'
import { Info, Scraper, UnitarySpider } from '../../types'
import { BATCH_LENGTH, SLEEP_TIME } from './constants.js'

interface SantaProduct {
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

interface SantaItem {
  images: SantaImage[]
  sellers: SantaSeller[]
}

interface SantaImage {
  imageUrl: string
  imageTag: string
}

interface SantaSeller {
  commertialOffer: {
    Price: number
    ListPrice: number
    PriceWithoutDiscount: number
    AvailableQuantity: number
  }
}

interface SantaAverage {
  average: number
  totalCount: number
  id: string
}

export class SantaUnitarySpider implements UnitarySpider {
  info: Info = {
    name: 'Santa Isabel',
    url: 'https://santaisabel.cl',
    logo: 'https://assets.santaisabel.cl/favicon/favicon-196x196.png'
  }

  headers: { [key: string]: string } = {
    apiKey: 'WlVnnB7c1BblmgUPOfg',
    'x-account': 'pedrofontova',
    'x-consumer': 'santaisabel'
  }

  average_url = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'

  async run (startUrls: string[]): Promise<Scraper[]> {
    console.log('Running Santa Unitary Spider')

    // Separar urls en batchs
    const splitUrls = this.getSplitArray(startUrls, BATCH_LENGTH)

    const products: SantaProduct[] = []
    for (const urls of splitUrls) {
      // espera x segundos
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME))

      // obtiene los productos de cada url
      const fetchProducts = await Promise.all(urls.map(async (url) => {
        const { data } = await axios.get<SantaProduct[]>(`${url}`, { headers: this.headers })
        return data[0]
      }))
      products.push(...fetchProducts)
    }

    // Obtener productos scrapeados
    const scrapedProducts = await Promise.all(products.map(async (product) => {
      if (product === undefined) return undefined

      let scraped = this.getMainData(product)
      if (scraped === undefined) return undefined
      scraped = this.getExtraData(scraped, product)
      return scraped
    }))

    // // Mostrar los productos incompletos
    // scrapedProducts.map((s) => {
    //   if (s?.url !== undefined && (s.title === undefined || s.brand === undefined || s.alcoholic_grade === undefined || s.content === undefined || s.quantity === undefined || s.package === undefined)) {
    //     console.log(s)
    //   }
    //   return s
    // })

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
    }) as Scraper[]

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

    return finalProducts
  }

  getSplitArray (arr: string[], size: number): string[][] {
    const result: string[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  getMainData (product: SantaProduct): Scraper | undefined {
    try {
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
    } catch (error) {
      console.log('Error al obtener los datos principales')
      console.log(product)
      return undefined
    }
  }

  getExtraData (scraped: Scraper, product: SantaProduct): Scraper {
    // Images
    try {
      const link = product.items[0].images[0].imageUrl
      const linkSplit = link.split('/')
      const linkParsed = linkSplit.slice(0, -1).join('/')

      scraped.image = linkParsed
    } catch (error) {
      console.log('Error al obtener las imagenes')
      scraped.image = undefined
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
    }
    if (product.Grado !== undefined && scraped.alcoholic_grade === undefined) {
      let match = product.Grado[0].match(/(\d+(?:\.\d+)?)°/)
      if (match === null) match = product.Grado[0].match(/(\d+(?:\.\d+)?)%/)
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

  async getAverages (products: Scraper[]): Promise<SantaAverage[] | undefined> {
    const skus = products.map((product) => product.product_sku).join(',')
    try {
      const { data } = await axios.get<SantaAverage[]>(`${this.average_url}?ids=${skus}`, { headers: this.headers })
      return data
    } catch (error) {
      console.log('Error al obtener los averages')
      return undefined
    }
  }
}
