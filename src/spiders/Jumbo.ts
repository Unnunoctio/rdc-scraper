import type { Info } from '../types'
import type { CencosudProduct, CencosudResponse, Spider } from './types'
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

    console.log(`Getting ${urlProducts.length} products`)
    const [completeProducts, incompleteProducts] = await this.getUnitaryProducts(urlProducts)
    console.log(`Completes ${completeProducts.length}`)
    console.log(`Incompletes ${incompleteProducts.length}`)

    return [[], [], []]
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

    console.log(`Scraping ${products.length}`)
    const productsFiltered = products.filter(product => product !== undefined) as Scraper[]
    console.log(`Filtereds ${productsFiltered.length}`)

    return [productsFiltered.filter(p => !p.isIncomplete()), productsFiltered.filter(p => p.isIncomplete())]
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
  // endregion
}
