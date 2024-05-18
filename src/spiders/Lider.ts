import { Info } from '../types'
import { LiderBody, LiderProduct, LiderResponse, Spider } from './types'
import { Scraper } from '../classes/Scraper.js'
import { Updater } from '../classes/Updater.js'

export class Lider implements Spider {
  // region Metadata
  info: Info = {
    name: 'Lider',
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
    const scrapedProducts: Scraper[] = []
    const incompleteProducts: Scraper[] = []

    for (const product of products) {
      let path: string | undefined
      try {
        path = `${this.pageUrl}/supermercado/product/sku/${product.sku}`
      } catch (error) {
        console.error('Error al generar el path:', product.displayName)
      }
      if (path === undefined) continue
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

      scrapedProducts.push(scraped)
    }

    return [updatedProducts, scrapedProducts, incompleteProducts]
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
