import type { Info } from '../../../types'
import { randomUserAgent } from '../../../utils/agent'
import { Scraper, Updater } from '../../classes'
import { SpiderName } from '../enums'
import type { LiderBody, LiderProduct, LiderResponse, Spider } from '../types'

export class Lider implements Spider {
  // region Metadata
  public readonly INFO: Info = {
    name: SpiderName.LIDER,
    logo: 'https://www.walmartchile.cl/wp-content/themes/walmartchile/img/favicon-32x32.png'
  }

  private readonly HEADERS = {
    'X-Channel': 'SOD',
    Tenant: 'supermercado',
    'Content-Type': 'application/json'
  }

  private readonly START_URL = 'https://apps.lider.cl/supermercado/bff/category'

  private readonly START_BODIES: LiderBody[] = [
    {
      categories: 'La Boti/Cervezas',
      page: 1,
      facets: [],
      sortBy: '',
      hitsPerPage: 100
    },
    {
      categories: 'La Boti/Destilados',
      page: 1,
      facets: [],
      sortBy: '',
      hitsPerPage: 100
    },
    {
      categories: 'La Boti/Vinos y Espumantes',
      page: 1,
      facets: [],
      sortBy: '',
      hitsPerPage: 100
    }
  ]

  private readonly PAGE_URL = 'https://www.lider.cl'
  // endregion

  // region RUN
  async run (paths: string[]): Promise<[Updater[], Scraper[], Scraper[]]> {
    const bodies = (await Promise.all(this.START_BODIES.map(async (body) => {
      return await this.getBodies(body)
    }))).flat()

    const products = (await Promise.all(bodies.map(async (body) => {
      return await this.getProducts(body)
    }))).flat()

    const updatedProducts: Updater[] = []
    const completeProducts: Scraper[] = []
    const incompleteProducts: Scraper[] = []

    for (const product of products) {
      if (product === undefined || product.sku === undefined) continue
      if (!product.available) continue

      const path = `${this.PAGE_URL}/supermercado/product/sku/${product.sku}`
      if (paths.includes(path)) {
        const updated = new Updater()
        updated.setLiderData(product, this.PAGE_URL)
        if (updated.isComplete()) updatedProducts.push(updated)
        continue
      }

      const scraped = new Scraper(this.INFO.name)
      scraped.setLiderData(product, this.PAGE_URL)

      if (scraped.isIncomplete()) {
        incompleteProducts.push(scraped)
        continue
      }

      completeProducts.push(scraped)
    }

    return [updatedProducts, completeProducts, incompleteProducts]
  }
  // endregion

  // region Functions
  async liderFetch (body: LiderBody): Promise<any> {
    const customHeaders = {
      ...this.HEADERS,
      'User-Agent': randomUserAgent()
    }

    const res = await fetch(this.START_URL, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify(body)
    })
    return await res.json()
  }

  async getBodies (body: LiderBody): Promise<LiderBody[]> {
    try {
      const data: LiderResponse = await this.liderFetch(body)

      const bodies: LiderBody[] = []
      for (let i = 1; i <= data.nbPages; i++) {
        bodies.push({ ...body, page: i })
      }
      return bodies
    } catch (error) {
      console.error('Error in fetch bodies', error)
      return []
    }
  }

  async getProducts (body: LiderBody): Promise<LiderProduct[]> {
    try {
      const data: LiderResponse = await this.liderFetch(body)
      return data.products
    } catch (error) {
      console.error('Error in fetch products', error)
      return []
    }
  }
  // endregion
}
