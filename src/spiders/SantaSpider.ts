import axios from 'axios'
import { Info, Scraper, UpdateWebsite } from '../types'
import { SantaAverage, SantaProduct, SantaResponse, Spider } from './types'
import { BATCH_SIZE, SLEEP_TIME } from '../config.js'

export class SantaSpider implements Spider {
  info: Info = {
    name: 'Santa Isabel',
    logo: 'https://assets.santaisabel.cl/favicon/favicon-196x196.png'
  }

  headers: { [key: string]: string } = {
    apiKey: 'WlVnnB7c1BblmgUPOfg',
    'x-account': 'pedrofontova',
    'x-consumer': 'santaisabel'
  }

  start_urls: string[] = [
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/cervezas',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/destilados',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/vinos'
  ]

  block_urls: string[] = [
    'https://www.santaisabel.cl/cerveza-torobayo-botella-330-cc-263611/p'
  ]

  page_url = 'https://www.santaisabel.cl'
  average_url = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'
  product_url = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/pedrofontova/product'

  async run (paths: string[]): Promise<[UpdateWebsite[], Scraper[]]> {
    console.log('Running Santa Spider')

    // Obtener todas las paginas por cada url
    const pages = (await Promise.all(this.start_urls.map(async (url) => {
      return await this.getPages(url)
    }))).flat()

    // Obtener todos los productos de todas las paginas
    const products = (await Promise.all(pages.map(async (url) => {
      const { data } = await axios.get<SantaResponse>(`${url}`, { headers: this.headers })
      return data.products
    }))).flat()

    const updatingProducts: Array<UpdateWebsite | undefined> = []
    const completeProducts: Scraper[] = []
    const incompletesUrls: string[] = []

    // Recorren los productos y se separan en los distintos arrays
    products.forEach((product) => {
      const path = `${this.page_url}/${product.linkText}/p`
      // Saltar los productos bloqueados
      if (this.block_urls.includes(path)) return

      // Productos que solo necesitan actualizar precio y average
      if (paths.includes(path)) {
        updatingProducts.push(this.getUpdateData(product))
        return
      }

      // Obtener toda la data del producto para saber si esta completo o incompleto
      let scraped = this.getMainData(product)
      if (scraped !== undefined) {
        scraped = this.getExtraData(scraped, product)
        const isIncomplete = (scraped.title === undefined || scraped.brand === undefined || scraped.alcoholic_grade === undefined || scraped.content === undefined || scraped.quantity === undefined || scraped.package === undefined)

        // Separamos entre completo o incompleto
        if (isIncomplete) incompletesUrls.push(`${this.product_url}/${product.linkText}`)
        else completeProducts.push(scraped)
      }
    })

    // Completa los productos incompletos y los agrega al array de productos completos
    completeProducts.push(...(await this.toCompleteData(incompletesUrls)))

    // Filtran todos los productos completos con el fin de que no se generen errores de datos faltantes
    const filteredProducts = completeProducts.filter((p) => {
      return p?.title !== undefined &&
             p.brand !== undefined &&
             p.category !== undefined &&
             p.url !== undefined &&
             p.price !== undefined && p.price !== 0 &&
             p.best_price !== undefined && p.best_price !== 0 &&
             p.image !== undefined &&
             p.alcoholic_grade !== undefined &&
             p.content !== undefined &&
             p.quantity !== undefined &&
             p.package !== undefined
    })

    // Obtener los averages de ambos arrays
    const updatingProductsAverage = await this.getUpdateAverages(updatingProducts.filter(u => u !== undefined && u.best_price !== 0 && u.price !== 0) as UpdateWebsite[])
    const completeProductsAverage = await this.getProductAverages(filteredProducts)

    return [updatingProductsAverage, completeProductsAverage]
  }

  async getPages (url: string): Promise<string[]> {
    const { data } = await axios.get<SantaResponse>(`${url}?sc=11`, { headers: this.headers })
    const total = Math.ceil(data.recordsFiltered / 40)

    const pages: string[] = []
    for (let i = 1; i <= total; i++) {
      pages.push(`${url}?sc=11&page=${i}`)
    }
    return pages
  }

  getUpdateData (product: SantaProduct): UpdateWebsite | undefined {
    try {
      return {
        product_sku: product.productId,
        url: `${this.page_url}/${product.linkText}/p`,
        price: product.items[0].sellers[0].commertialOffer.PriceWithoutDiscount,
        best_price: product.items[0].sellers[0].commertialOffer.Price
      }
    } catch (error) {
      console.log('Error al obtener los datos para actualizar')
      return undefined
    }
  }

  getMainData (product: SantaProduct): Scraper | undefined {
    try {
      const scraped: Scraper = {
        website: this.info.name,
        product_sku: product.productId,
        title: product.productName,
        brand: product.brand,
        category: product.categories[0].split('/')[2],
        url: `${this.page_url}/${product.linkText}/p`,
        price: product.items[0].sellers[0].commertialOffer.PriceWithoutDiscount,
        best_price: product.items[0].sellers[0].commertialOffer.Price
      }
      return scraped
    } catch (error) {
      console.log('Error al obtener los datos principales', error)
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
    if (product.productName.includes('°') && scraped.alcoholic_grade === undefined) {
      const match = product.productName.match(/(\d+(?:\.\d+)?)°/)
      scraped.alcoholic_grade = (match != null) ? Number(match[1]) : undefined
    }

    // Content
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

  async toCompleteData (incompleteUrls: string[]): Promise<Scraper[]> {
    // Separar urls en batchs
    const splitUrls = this.getSplitArray(incompleteUrls, BATCH_SIZE)

    const products: SantaProduct[] = []
    for (const urls of splitUrls) {
      // espera x segundos
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME))

      // obtiene los productos de cada url
      const fetchProducts = await Promise.all(urls.map(async (url) => {
        try {
          const { data } = await axios.get<SantaProduct[]>(`${url}`, { headers: this.headers })
          return data[0]
        } catch (error) {
          console.log(`Error al hacer fetch: ${url}`)
        }
        return undefined
      }))
      products.push(...fetchProducts.filter(p => p !== undefined) as SantaProduct[])
    }

    // Obtener productos scrapeados
    const scrapedProducts = await Promise.all(products.map(async (product) => {
      let scraped = this.getMainData(product)
      if (scraped === undefined) return undefined
      scraped = this.getExtraData(scraped, product)
      return scraped
    }))

    return scrapedProducts.filter(s => s !== undefined) as Scraper[]
  }

  getSplitArray (arr: string[], size: number): string[][] {
    const result: string[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  async getUpdateAverages (updates: UpdateWebsite[]): Promise<UpdateWebsite[]> {
    const skus = updates.map(u => u.product_sku).join(',')
    try {
      const { data } = await axios<SantaAverage[]>(`${this.average_url}?ids=${skus}`, { headers: this.headers })
      return updates.map(u => {
        const average = data.find(a => a.id === u.product_sku)
        if (average !== undefined && average.totalCount !== 0) {
          return { ...u, average: average.average }
        } else if (average !== undefined && average.totalCount === 0) {
          return { ...u, average: null }
        }
        return u
      })
    } catch (error) {
      console.log('Error al obtener los averages para actualizar', error)
      return updates
    }
  }

  async getProductAverages (products: Scraper[]): Promise<Scraper[]> {
    const skus = products.map(u => u.product_sku).join(',')
    try {
      const { data } = await axios<SantaAverage[]>(`${this.average_url}?ids=${skus}`, { headers: this.headers })
      return products.map(u => {
        const average = data.find(a => a.id === u.product_sku)
        if (average !== undefined && average.totalCount !== 0) {
          return { ...u, average: average.average }
        } else if (average !== undefined && average.totalCount === 0) {
          return { ...u, average: null }
        }
        return u
      })
    } catch (error) {
      console.log('Error al obtener los averages para actualizar', error)
      return products
    }
  }
}
