import type { Info } from '../types'
import type { LiderBody, LiderProduct, LiderResponse, Spider } from './types'
import { SpiderName } from '../utils/enums'
import { Scraper, Updater } from '../classes'

export class Lider implements Spider {
  // region Metadata
  info: Info = {
    name: SpiderName.LIDER,
    logo: 'https://www.walmartchile.cl/wp-content/themes/walmartchile/img/favicon-32x32.png'
  }

  headers = {
    'X-Channel': 'SOD',
    Tenant: 'supermercado',
    'Content-Type': 'application/json'
  }

  startUrl = 'https://apps.lider.cl/supermercado/bff/category'

  startBodies: LiderBody[] = [
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

  blockUrls: string[] = []

  pageUrl = 'https://www.lider.cl'
  // endregion

  // region RUN
  async run (paths: string[]): Promise<[Updater[], Scraper[], Scraper[]]> {
    console.log('Running Lider Spider')

    const bodies = (await Promise.all(this.startBodies.map(async (body) => {
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

      const path = `${this.pageUrl}/supermercado/product/sku/${product.sku}`
      if (this.blockUrls.includes(path)) continue

      if (paths.includes(path)) {
        const updated = new Updater()
        updated.setLiderData(product, this.pageUrl)
        if (updated.isComplete()) updatedProducts.push(updated)
        continue
      }

      const scraped = new Scraper(this.info.name)
      scraped.setLiderData(product, this.pageUrl)

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
  async getBodies (body: LiderBody): Promise<LiderBody[]> {
    const res = await fetch(this.startUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    })
    const data: LiderResponse = await res.json()

    const bodies: LiderBody[] = []
    for (let i = 1; i <= data.nbPages; i++) {
      bodies.push({ ...body, page: i })
    }
    return bodies
  }

  async getProducts (body: LiderBody): Promise<LiderProduct[]> {
    const res = await fetch(this.startUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    })
    const data: LiderResponse = await res.json()
    return data.products
  }
  // endregion
}
