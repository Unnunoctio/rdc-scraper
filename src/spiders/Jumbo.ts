import type { Info } from '../types'
import type { CencosudAverage, CencosudProduct, CencosudResponse, Spider } from './types'
import { SpiderName } from '../enums'
import { Scraper, Updater } from '../classes'

export class Jumbo implements Spider {
  // region Metadata
  public readonly INFO: Info = {
    name: SpiderName.JUMBO,
    logo: 'https://assets.jumbo.cl/favicon/favicon-192.png'
  }

  private readonly HEADERS = {
    apiKey: 'WlVnnB7c1BblmgUPOfg',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
  }

  private readonly START_URLS = [
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/cervezas',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/destilados',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/vinos'
  ]

  private readonly PAGE_URL = 'https://www.jumbo.cl'
  private readonly PRODUCT_URL = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/product'
  private readonly AVERAGE_URL = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'
  private readonly AVERAGE_STEP = 300
  // endregion

  // region RUN
  async run (paths: string[]): Promise<[Updater[], Scraper[], Scraper[]]> {
    console.log(`Running ${SpiderName.JUMBO} Spider`)

    const pages = (await Promise.all(this.START_URLS.map(async (url) => {
      return await this.getPages(url)
    }))).flat()

    const products = (await Promise.all(pages.map(async (page) => {
      return await this.getProducts(page)
    }))).flat()

    const updatedProducts: Updater[] = []
    const urlProducts: string[] = []

    for (const product of products) {
      if (product === undefined || product.linkText === undefined) continue
      if (product.items[0].sellers[0].commertialOffer.AvailableQuantity === 0) continue

      const path = `${this.PAGE_URL}/${product.linkText}/p`
      if (paths.includes(path)) {
        const updated = new Updater()
        updated.setCencosudData(product, this.PAGE_URL)
        if (updated.isComplete()) updatedProducts.push(updated)
        continue
      }

      urlProducts.push(`${this.PRODUCT_URL}/${product.linkText}`)
    }

    const [completeProducts, incompleteProducts] = await this.getUnitaryProducts(urlProducts)

    await this.getAverages(updatedProducts)
    await this.getAverages(completeProducts)

    return [updatedProducts, completeProducts, incompleteProducts]
  }
  // endregion

  // region Functions
  async getPages (url: string): Promise<string[]> {
    try {
      const res = await fetch(`${url}?sc=11`, { headers: this.HEADERS })
      const data: CencosudResponse = await res.json()

      const total = Math.ceil(data.recordsFiltered / 40)
      const pages = Array.from({ length: total }, (_, i) => `${url}?sc=11&page=${i + 1}`)
      return pages
    } catch (error) {
      console.error(`Error in fetch pages: ${url}`, error)
      return []
    }
  }

  async getProducts (page: string): Promise<CencosudProduct[]> {
    try {
      const res = await fetch(page, { headers: this.HEADERS })
      const data: CencosudResponse = await res.json()
      return data.products
    } catch (error) {
      console.error(`Error in fetch products: ${page}`, error)
      return []
    }
  }

  async getUnitaryProducts (urls: string[]): Promise<[Scraper[], Scraper[]]> {
    const products = await Promise.all(urls.map(async (url) => {
      const product = await this.getProduct(url)
      if (product === undefined) return undefined

      const scraped = new Scraper(this.INFO.name)
      scraped.setCencosudData(product, this.PAGE_URL)
      return scraped
    }))

    const productsFiltered = products.filter(product => product !== undefined) as Scraper[]
    return [productsFiltered.filter(p => !p.isIncomplete()), productsFiltered.filter(p => p.isIncomplete())]
  }

  async getProduct (url: string): Promise<CencosudProduct | undefined> {
    try {
      const res = await fetch(url, { headers: this.HEADERS })
      const data: CencosudProduct[] = await res.json()
      return data[0]
    } catch (error) {
      console.error(`Error in fetch: ${url}`)
      return undefined
    }
  }

  async getAverages (items: Updater[] | Scraper[]): Promise<void> {
    for (let i = 0; i < items.length; i += this.AVERAGE_STEP) {
      const skus = items.slice(i, i + this.AVERAGE_STEP).map((i: any) => i.productSku).join(',')
      try {
        const res = await fetch(`${this.AVERAGE_URL}?ids=${skus}`, { headers: this.HEADERS })
        const data: CencosudAverage[] = await res.json()
        for (const item of items) {
          const average = data.find(a => a.id === item.productSku)
          if (average !== undefined && average.totalCount !== 0) item.average = average.average
        }
      } catch (error) {
        console.error('Error when obtaining averages')
      }
    }
  }
  // endregion
}
