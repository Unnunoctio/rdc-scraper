import axios from 'axios'
import { Info } from '../types'
import { CencosudAverage, CencosudProduct, CencosudResponse, Spider } from './types'
import { ScraperClass } from '../classes/ScraperClass.js'
import { UpdaterClass } from '../classes/UpdaterClass.js'
import { BATCH_SIZE, SLEEP_TIME } from '../config.js'

export class JumboSpider implements Spider {
  info: Info = {
    name: 'Jumbo',
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

  block_urls: string[] = [
    'https://www.jumbo.cl/cerveza-kunstmann-botella-330-cc-torobayo-nacional/p'
  ]

  page_url = 'https://www.jumbo.cl'
  average_url = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'
  product_url = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/product'

  async run (paths: string[]): Promise<[UpdaterClass[], ScraperClass[]]> {
    console.log('Running Jumbo Spider')

    // Obtener todas las paginas por cada url
    const pages = (await Promise.all(this.start_urls.map(async (url) => {
      return await this.getPages(url)
    }))).flat()

    // Obtener todos los productos de todas las paginas
    const products = (await Promise.all(pages.map(async (url) => {
      const { data } = await axios.get<CencosudResponse>(`${url}`, { headers: this.headers })
      return data.products
    }))).flat()

    const updatedProducts: UpdaterClass[] = []
    const scrapedProducts: ScraperClass[] = []
    const incompleteUrls: string[] = []

    for (const product of products) {
      const path = `${this.page_url}/${product.linkText}/p`
      if (this.block_urls.includes(path)) continue

      if (paths.includes(path)) {
        const updated = new UpdaterClass(product, this.info.name, this.page_url)
        if (updated.isComplete()) updatedProducts.push(updated)
        continue
      }

      const scraped = new ScraperClass(product, this.info.name, this.page_url)
      if (scraped.isIncomplete()) incompleteUrls.push(`${this.product_url}/${product.linkText}`)
      else scrapedProducts.push(scraped)
    }

    scrapedProducts.push(...(await this.getIncompletes(incompleteUrls)))

    const filteredProducts: ScraperClass[] = []
    for (const scraped of scrapedProducts) {
      if (scraped.isComplete()) filteredProducts.push(scraped)
    }

    await this.getAverages(updatedProducts)
    await this.getAverages(filteredProducts)

    return [updatedProducts, filteredProducts]
  }

  async getPages (url: string): Promise<string[]> {
    const { data } = await axios.get<CencosudResponse>(`${url}?sc=11`, { headers: this.headers })
    const total = Math.ceil(data.recordsFiltered / 40)

    const pages: string[] = []
    for (let i = 1; i <= total; i++) {
      pages.push(`${url}?sc=11&page=${i}`)
    }
    return pages
  }

  async getIncompletes (urls: string[]): Promise<ScraperClass[]> {
    const splitUrls = this.getSplitArray(urls, BATCH_SIZE)

    const allProducts: CencosudProduct[] = []
    for (const urls of splitUrls) {
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME))

      const products = await Promise.all(urls.map(async (url) => {
        try {
          const { data } = await axios.get<CencosudProduct[]>(`${url}`, { headers: this.headers })
          return data[0]
        } catch (error) {
          console.log(`Error al hacer fetch: ${url}`)
        }
        return undefined
      }))
      allProducts.push(...products.filter(p => p !== undefined) as CencosudProduct[])
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

  async getAverages (items: UpdaterClass[] | ScraperClass[]): Promise<void> {
    const skus = items.map(i => i.product_sku).join(',')
    try {
      const { data } = await axios<CencosudAverage[]>(`${this.average_url}?ids=${skus}`, { headers: this.headers })
      for (const item of items) {
        const average = data.find(a => a.id === item.product_sku)
        if (average !== undefined && average.totalCount !== 0) item.average = average.average
      }
    } catch (error) {
      console.log('Error al obtener los averages', error)
    }
  }
}
