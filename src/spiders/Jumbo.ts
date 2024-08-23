import type { Info } from '../types'
import type { CencosudAverage, CencosudProduct, CencosudResponse, Spider } from './types'
import { SpiderName } from '../enums'
import { Scraper, Updater } from '../classes'
import axios from 'axios'

export class Jumbo implements Spider {
  // region Metadata
  info: Info = {
    name: SpiderName.JUMBO,
    logo: 'https://assets.jumbo.cl/favicon/favicon-192.png'
  }

  headers = {
    'Content-Type': 'application/json',
    apiKey: 'WlVnnB7c1BblmgUPOfg',
    Host: 'sm-web-api.ecomm.cencosud.com',
    Origin: 'https://www.jumbo.cl',
    Referer: 'https://www.jumbo.cl/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'x-consumer': 'jumbo',
    'x-e-commerce': 'jumbo'
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
    console.log(pages)

    // const products = (await Promise.all(pages.map(async (page) => {
    //   return await this.getProducts(page)
    // }))).flat()

    // const updatedProducts: Updater[] = []
    // const urlProducts: string[] = []

    // for (const product of products) {
    //   if (product === undefined || product.linkText === undefined) continue

    //   const path = `${this.pageUrl}/${product.linkText}/p`
    //   if (this.blockUrls.includes(path)) continue

    //   if (paths.includes(path)) {
    //     const updated = new Updater()
    //     updated.setCencosudData(product, this.pageUrl)
    //     if (updated.isComplete()) updatedProducts.push(updated)
    //     continue
    //   }

    //   urlProducts.push(`${this.productUrl}/${product.linkText}`)
    // }

    // const [completeProducts, incompleteProducts] = await this.getUnitaryProducts(urlProducts)

    // await this.getAverages(updatedProducts)
    // await this.getAverages(completeProducts)

    // return [updatedProducts, completeProducts, incompleteProducts]
    return [[], [], []]
  }
  // endregion

  // region Functions
  async getPages (url: string): Promise<string[]> {
    try {
      const { data } = await axios.get<CencosudResponse>(`${url}?sc=11`, { headers: this.headers })
      console.log(data)
      // const res = await fetch(`${url}?sc=11`, { headers: this.headers })
      // const data: CencosudResponse = await res.json()

      const total = Math.ceil(data.recordsFiltered / 40)
      const pages = Array.from({ length: total }, (_, i) => `${url}?sc=11&page=${i + 1}`)
      return pages
    } catch (error) {
      console.error(`Error in fetch pages: ${url}`, error)
      return []
    }
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
}
