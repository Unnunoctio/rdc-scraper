import axios from 'axios'
import { Info } from '../types'
import { LiderBody, LiderProduct, LiderResponse, Spider } from './types'
import { ScraperClass } from '../classes/ScraperClass.js'
import { UpdaterClass } from '../classes/UpdaterClass.js'
import { BATCH_SIZE, SLEEP_TIME } from '../config.js'

export class LiderSpider implements Spider {
  info: Info = {
    name: 'Lider',
    logo: 'https://www.walmartchile.cl/wp-content/themes/walmartchile/img/favicon-32x32.png'
  }

  headers: { [key: string]: string } = {
    'X-Channel': 'SOD',
    Tenant: 'supermercado'
  }

  start_urls: string[] = [
    'https://apps.lider.cl/supermercado/bff/category'
  ]

  start_bodies: LiderBody[] = [
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

  block_urls: string[] = []

  page_url = 'https://www.lider.cl'
  product_url = 'https://apps.lider.cl/supermercado/bff/products'

  async run (paths: string[]): Promise<[UpdaterClass[], ScraperClass[]]> {
    console.log('Running Lider Spider')

    // Obtener todas las paginas por cada body
    const bodies = (await Promise.all(this.start_bodies.map(async (body) => {
      return await this.getBodies(body)
    }))).flat()

    // Obtener todos los productos de todos los body
    const products = (await Promise.all(bodies.map(async (body) => {
      const { data } = await axios.post<LiderResponse>(`${this.start_urls[0]}`, body, { headers: this.headers })
      return data.products
    }))).flat()

    const updatedProducts: UpdaterClass[] = []
    const scrapedProducts: ScraperClass[] = []
    const incompleteUrls: string[] = []

    for (const product of products) {
      const path = `${this.page_url}/supermercado/product/sku/${product.sku}`
      if (this.block_urls.includes(path)) continue

      if (paths.includes(path)) {
        const updated = new UpdaterClass(product, this.info.name, this.page_url)
        if (updated.isComplete()) updatedProducts.push(updated)
        continue
      }

      const scraped = new ScraperClass(product, this.info.name, this.page_url)
      if (scraped.isIncomplete()) incompleteUrls.push(`${this.product_url}/${product.sku}`)
      else scrapedProducts.push(scraped)
    }

    scrapedProducts.push(...(await this.getIncompletes(incompleteUrls)))

    const filteredProducts: ScraperClass[] = []
    for (const scraped of scrapedProducts) {
      if (scraped.isComplete()) filteredProducts.push(scraped)
    }

    return [updatedProducts, filteredProducts]
  }

  async getBodies (body: LiderBody): Promise<LiderBody[]> {
    const { data } = await axios.post<LiderResponse>(`${this.start_urls[0]}`, body, { headers: this.headers })

    const bodies: LiderBody[] = []
    for (let i = 1; i <= data.nbPages; i++) {
      bodies.push({ ...body, page: i })
    }
    return bodies
  }

  async getIncompletes (urls: string[]): Promise<ScraperClass[]> {
    const splitUrls = this.getSplitArray(urls, BATCH_SIZE)

    const allProducts: LiderProduct[] = []
    for (const urls of splitUrls) {
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME))

      const products = await Promise.all(urls.map(async (url) => {
        try {
          const { data } = await axios.get<LiderProduct[]>(`${url}`, { headers: this.headers })
          return data[0]
        } catch (error) {
          console.log(`Error al hacer fetch: ${url}`)
        }
        return undefined
      }))
      allProducts.push(...products.filter(p => p !== undefined) as LiderProduct[])
    }

    const scrapedProducts: ScraperClass[] = []
    for (const product of allProducts) {
      const scraped = new ScraperClass(product, this.info.name, this.page_url)
      if (!scraped.isIncomplete()) scrapedProducts.push(scraped)
    }

    return scrapedProducts
  }

  getSplitArray (arr: string[], size: number): string[][] {
    const result: string[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }
}
