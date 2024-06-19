import type { Info } from '../types'
import type { CencosudAverage, CencosudProduct, CencosudResponse, Spider } from './types'
import { SpiderName } from '../utils/enums'
import { Scraper, Updater } from '../classes'

export class Jumbo implements Spider {
  // region Metadata
  info: Info = {
    name: SpiderName.JUMBO,
    logo: 'https://assets.jumbo.cl/favicon/favicon-192.png'
  }

  headers = {
    apiKey: 'WlVnnB7c1BblmgUPOfg'
  }

  startUrls = [
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/cervezas',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/destilados',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/vinos'
  ]

  blockUrls = [
    'https://www.jumbo.cl/cerveza-kunstmann-botella-330-cc-torobayo-nacional/p'
  ]

  pageUrl = 'https://www.jumbo.cl'
  averageUrl = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'
  productUrl = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/product'
  // endregion

  // region RUN
  async run (paths: string[]): Promise<[Updater[], Scraper[], Scraper[]]> {
    console.log(`Running ${SpiderName.JUMBO} Spider`)

    const pages = (await Promise.all(this.startUrls.map(async (url) => {
      return await this.getPages(url)
    }))).flat()

    const products = (await Promise.all(pages.map(async (page) => {
      return await this.getProducts(page)
    }))).flat()

    const updatedProducts: Updater[] = []
    const urlProducts: string[] = []

    for (const product of products) {
      if (product.linkText === undefined) continue

      const path = `${this.pageUrl}/${product.linkText}/p`
      if (this.blockUrls.includes(path)) continue
      if (!paths.includes(path)) urlProducts.push(`${this.productUrl}/${product.linkText}`)

      const updated = new Updater()
      updated.setCencosudData(product, this.pageUrl)
      if (updated.isComplete()) updatedProducts.push(updated)
    }

    console.log('total products:', urlProducts)
    const [completeProducts, incompleteProducts] = await this.getUnitaryProducts(urlProducts)
    console.log('complete products:', completeProducts.length)
    console.log('incomplete products:', incompleteProducts.length)

    console.log('--------------------------------')
    const [com, incom] = await this.getIncompletes(urlProducts)
    console.log('complete products lento:', com.length)
    console.log('incomplete products lento:', incom.length)

    console.log('--------------------------------')

    await this.getAverages(updatedProducts)
    await this.getAverages(completeProducts)

    return [updatedProducts, completeProducts, incompleteProducts]
  }
  // endregion

  // region Functions
  async getPages (url: string): Promise<string[]> {
    const res = await fetch(`${url}?sc=11`, { headers: this.headers })
    const data: CencosudResponse = await res.json()

    const total = Math.ceil(data.recordsFiltered / 40)
    const pages = Array.from({ length: total }, (_, i) => `${url}?sc=11&page=${i + 1}`)
    return pages
  }

  async getProducts (page: string): Promise<CencosudProduct[]> {
    const res = await fetch(page, { headers: this.headers })
    const data: CencosudResponse = await res.json()

    return data.products
  }

  async getUnitaryProducts (urls: string[]): Promise<[Scraper[], Scraper[]]> {
    const products = await Promise.all(urls.map(async (url) => {
      const product = await this.getProduct(url)
      if (product === undefined) return undefined

      const scraped = new Scraper(this.info.name)
      scraped.setCencosudData(product, this.pageUrl)
      return scraped
    }))

    const productsFiltered = products.filter(product => product !== undefined) as Scraper[]
    return [productsFiltered.filter(p => !p.isIncomplete()), productsFiltered.filter(p => p.isIncomplete())]
  }

  async getProduct (url: string): Promise<CencosudProduct | undefined> {
    try {
      const res = await fetch(url, { headers: this.headers })
      const data: CencosudProduct[] = await res.json()
      return data[0]
    } catch (error) {
      console.error(`Error in fetch: ${url}`)
      return undefined
    }
  }

  async getAverages (items: Updater[] | Scraper[]): Promise<void> {
    const skus = items.map((i: any) => i.productSku).join(',')
    try {
      const res = await fetch(`${this.averageUrl}?ids=${skus}`, { headers: this.headers })
      const data: CencosudAverage[] = await res.json()
      for (const item of items) {
        const average = data.find(a => a.id === item.productSku)
        if (average !== undefined && average.totalCount !== 0) item.average = average.average
      }
    } catch (error) {
      console.error('Error when obtaining averages')
    }
  }
  // endregion

  // region Test
  splitArray (arr: string[]): string[][] {
    const chunks: string[][] = []
    for (let i = 0; i < arr.length; i += 300) {
      chunks.push(arr.slice(i, i + 300))
    }
    return chunks
  }

  async getIncompletes (urls: string[]): Promise<[Scraper[], Scraper[]]> {
    const splitUrls = this.splitArray(urls)

    const allProducts: CencosudProduct[] = []
    for (const urls of splitUrls) {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const products = await Promise.all(urls.map(async (url) => {
        return await this.getProduct(url)
      }))

      allProducts.push(...products.filter(p => p !== undefined) as CencosudProduct[])
    }

    const scrapedProducts: Scraper[] = []
    for (const product of allProducts) {
      const scraped = new Scraper(this.info.name)
      scraped.setCencosudData(product, this.pageUrl)
      scrapedProducts.push(scraped)
    }

    return [scrapedProducts.filter(s => !s.isIncomplete()), scrapedProducts.filter(s => s.isIncomplete())]
  }
  // endregion
}
