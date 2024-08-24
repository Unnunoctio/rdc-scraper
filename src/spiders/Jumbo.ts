import type { Info } from '../types'
import type { CencosudProduct, CencosudResponse, Spider } from './types'
import { SpiderName } from '../enums'
import { Scraper, Updater } from '../classes'
import { curlFetch } from '../helper/fetch'

export class Jumbo implements Spider {
  // region Metadata
  public readonly INFO: Info = {
    name: SpiderName.JUMBO,
    logo: 'https://assets.jumbo.cl/favicon/favicon-192.png'
  }

  private readonly HEADERS = [
    'apiKey: WlVnnB7c1BblmgUPOfg'
  ]

  private readonly START_URLS = [
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/cervezas',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/destilados',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/vinos'
  ]

  private readonly BLOCK_URLS = [
    'https://www.jumbo.cl/cerveza-kunstmann-botella-330-cc-torobayo-nacional/p'
  ]

  private readonly PAGE_URL = 'https://www.jumbo.cl'
  private readonly AVERAGE_URL = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'
  private readonly PRODUCT_URL = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/product'
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

      const path = `${this.PAGE_URL}/${product.linkText}/p`
      if (this.BLOCK_URLS.includes(path)) continue
      if (product.items[0].sellers[0].commertialOffer.AvailableQuantity === 0) continue

      if (paths.includes(path)) {
        const updated = new Updater()
        updated.setCencosudData(product, this.PAGE_URL)
        if (updated.isComplete()) updatedProducts.push(updated)
        continue
      }

      urlProducts.push(`${this.PRODUCT_URL}/${product.linkText}`)
    }

    const [completeProducts, incompleteProducts] = await this.getUnitaryProducts(urlProducts)

    // await this.getAverages(updatedProducts)
    // await this.getAverages(completeProducts)

    return [updatedProducts, completeProducts, incompleteProducts]
  }
  // endregion

  // region Functions
  async getPages (url: string): Promise<string[]> {
    try {
      const data: CencosudResponse = await curlFetch(`${url}?sc=11`, this.HEADERS)

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
      const data: CencosudResponse = await curlFetch(page, this.HEADERS)
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
      const data: CencosudProduct[] = await curlFetch(url, this.HEADERS)
      return data[0]
    } catch (error) {
      console.error(`Error in fetch: ${url}`)
      return undefined
    }
  }

  // async getAverages (items: Updater[] | Scraper[]): Promise<void> {
  //   const skus = items.map((i: any) => i.productSku).join(',')
  //   try {
  //     const res = await fetch(`${this.averageUrl}?ids=${skus}`, { headers: this.headers })
  //     const data: CencosudAverage[] = await res.json()
  //     for (const item of items) {
  //       const average = data.find(a => a.id === item.productSku)
  //       if (average !== undefined && average.totalCount !== 0) item.average = average.average
  //     }
  //   } catch (error) {
  //     console.error('Error when obtaining averages')
  //   }
  // }
  // endregion
}
