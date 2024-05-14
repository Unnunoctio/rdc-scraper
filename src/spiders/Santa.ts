import { Info } from '../types'
import { CencosudAverage, CencosudProduct, CencosudResponse } from './types'
import { BATCH_SIZE, SLEEP_TIME } from '../config.js'
import { Scraper } from '../classes/Scraper.js'
import { Updater } from '../classes/Updater.js'

export class Santa {
  // region Metadata
  info: Info = {
    name: 'Santa Isabel',
    logo: 'https://assets.santaisabel.cl/favicon/favicon-196x196.png'
  }

  headers = {
    apiKey: 'WlVnnB7c1BblmgUPOfg',
    'x-account': 'pedrofontova',
    'x-consumer': 'santaisabel'
  }

  startUrls = [
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/cervezas',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/destilados',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/vinos'
  ]

  blockUrls = [
    'https://www.santaisabel.cl/cerveza-torobayo-botella-330-cc-263611/p'
  ]

  pageUrl = 'https://www.santaisabel.cl'
  averageUrl = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'
  productUrl = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/pedrofontova/product'
  // endregion

  // region RUN
  async run (paths: string[]): Promise<[Updater[], Scraper[], Scraper[]]> {
    console.log('Running Santa Isabel Spider')

    const pages = (await Promise.all(this.startUrls.map(async (url) => {
      return await this.getPages(url)
    }))).flat()

    const products = (await Promise.all(pages.map(async (page) => {
      return await this.getProducts(page)
    }))).flat()

    const updatedProducts: Updater[] = []
    const scrapedProducts: Scraper[] = []
    const incompleteUrls: string[] = []

    for (const product of products) {
      const path = `${this.pageUrl}/${product.linkText}/p`
      if (this.blockUrls.includes(path)) continue

      if (paths.includes(path)) {
        const updated = new Updater()
        updated.setCencosudData(product, this.pageUrl)
        if (updated.isComplete()) updatedProducts.push(updated)
        continue
      }

      const scraped = new Scraper(this.info.name)
      scraped.setCencosudData(product, this.pageUrl)

      if (scraped.isIncomplete()) {
        incompleteUrls.push(`${this.productUrl}/${product.linkText}`)
        continue
      }

      scrapedProducts.push(scraped)
    }

    const [completeProducts, incompleteProducts] = await this.getIncompletes(incompleteUrls)
    scrapedProducts.push(...completeProducts)

    await this.getAverages(updatedProducts)
    await this.getAverages(scrapedProducts)

    return [updatedProducts, scrapedProducts, incompleteProducts]
  }
  // endregion

  // region Functions
  async getPages (url: string): Promise<string[]> {
    const res = await fetch(`${url}?sc=11`, { headers: this.headers })
    const data: CencosudResponse = await res.json()

    const total = Math.ceil(data.recordsFiltered / 40)
    const pages: string[] = []
    for (let i = 1; i <= total; i++) {
      pages.push(`${url}?sc=11&page=${i}`)
    }
    return pages
  }

  async getProducts (page: string): Promise<CencosudProduct[]> {
    const res = await fetch(page, { headers: this.headers })
    const data: CencosudResponse = await res.json()

    return data.products
  }

  async getIncompletes (urls: string[]): Promise<[Scraper[], Scraper[]]> {
    console.log('all urls:', urls.length)
    const splitUrls = this.splitArray(urls)

    const allProducts: CencosudProduct[] = []
    for (const urls of splitUrls) {
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME))

      const products = await Promise.all(urls.map(async (url) => {
        return await this.getProduct(url)
      }))

      allProducts.push(...products.filter(p => p !== undefined) as CencosudProduct[])
    }

    console.log('all products in get incompletes urls:', allProducts.length)

    const scrapedProducts: Scraper[] = []
    for (const product of allProducts) {
      const scraped = new Scraper(this.info.name)
      scraped.setCencosudData(product, this.pageUrl)
      scrapedProducts.push(scraped)
    }

    return [scrapedProducts.filter(s => !s.isIncomplete()), scrapedProducts.filter(s => s.isIncomplete())]
  }

  splitArray (arr: string[]): string[][] {
    const chunks: string[][] = []
    for (let i = 0; i < arr.length; i += BATCH_SIZE) {
      chunks.push(arr.slice(i, i + BATCH_SIZE))
    }
    return chunks
  }

  async getProduct (url: string): Promise<CencosudProduct | undefined> {
    try {
      const res = await fetch(url, { headers: this.headers })
      const data: CencosudProduct[] = await res.json()
      return data[0]
    } catch (error) {
      console.error(`Error al hacer fetch: ${url}`)
      return undefined
    }
  }

  async getAverages (items: Updater[] | Scraper[]): Promise<void> {
    const skus = items.map((i: any) => i.product_sku).join(',')
    try {
      const res = await fetch(`${this.averageUrl}?ids=${skus}`, { headers: this.headers })
      const data: CencosudAverage[] = await res.json()
      for (const item of items) {
        const average = data.find(a => a.id === item.productSku)
        if (average !== undefined && average.totalCount !== 0) item.average = average.average
      }
    } catch (error) {
      console.log('Error al obtener los averages')
    }
  }
  // endregion
}
