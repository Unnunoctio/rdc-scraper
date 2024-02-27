import axios from 'axios'
import { Info, Scraper, UnitarySpider } from '../../types'
import { BATCH_LENGTH, SLEEP_TIME } from './constants.js'

interface Product {
  sku: string
  brand: string
  displayName: string
  images: Images
  specifications: Specification[]
  price: Price
  categorias: string[]
  available: boolean
}

interface Images {
  defaultImage: string
  smallImage: string
  mediumImage: string
  largeImage: string
}

interface Specification {
  name: string
  value: string
}

interface Price {
  BasePriceReference: number
  BasePriceSales: number
}

export class LiderUnitarySpider implements UnitarySpider {
  info: Info = {
    name: 'Lider',
    url: 'https://www.lider.cl',
    logo: 'https://www.walmartchile.cl/wp-content/themes/walmartchile/img/favicon-32x32.png'
  }

  headers: { [key: string]: string } = {
    'X-Channel': 'SOD',
    Tenant: 'supermercado'
  }

  async run (startUrls: string[]): Promise<Scraper[]> {
    console.log('Running Lider Unitary Spider')

    // Separar urls en batchs
    const splitUrls = this.getSplitArray(startUrls, BATCH_LENGTH)

    const products: Product[] = []
    for (const urls of splitUrls) {
      // espera x segundos
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME))

      // obtiene los productos de cada url
      const fetchProducts = await Promise.all(urls.map(async (url) => {
        try {
          const { data } = await axios.get<Product[]>(`${url}`, { headers: this.headers })
          return data[0]
        } catch (error) {
          console.log(`Error al hacer fetch: ${url}`)
        }
        return undefined
      }))
      products.push(...fetchProducts.filter(p => p !== undefined) as Product[])
    }

    // Obtener productos scrapeados
    const scrapedProducts = await Promise.all(products.map(async (product) => {
      let scraped = this.getMainData(product)
      if (scraped === undefined) return undefined
      scraped = this.getExtraData(scraped, product)
      return scraped
    }))

    // // Mostrar los productos incompletos
    // let i = 0
    // scrapedProducts.map((s) => {
    //   if (s?.url !== undefined && (s.title === undefined || s.brand === undefined || s.alcoholic_grade === undefined || s.content === undefined || s.quantity === undefined || s.package === undefined)) {
    //     i += 1
    //     console.log(i)
    //     console.log(s)
    //   }
    //   return s
    // })

    // Filtrar productos scrapeados correctos
    const filtered = scrapedProducts.filter((scraped) => {
      return scraped?.title !== undefined &&
             scraped.brand !== undefined &&
             scraped.category !== undefined &&
             scraped.url !== undefined &&
             scraped.price !== undefined && scraped.price !== 0 &&
             scraped.best_price !== undefined && scraped.best_price !== 0 &&
             scraped.image !== undefined &&
             scraped.alcoholic_grade !== undefined &&
             scraped.content !== undefined &&
             scraped.quantity !== undefined &&
             scraped.package !== undefined
    })

    const finalProducts = filtered.map((scraped) => {
      return {
        ...scraped,
        average: null
      }
    })

    return finalProducts as Scraper[]
  }

  getSplitArray (arr: string[], size: number): string[][] {
    const result: string[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  getMainData (product: Product): Scraper | undefined {
    try {
      const scraped: Scraper = {
        website: this.info.name,
        product_sku: product.sku,
        title: product.displayName,
        brand: product.brand,
        category: this.getCategory(product.categorias),
        url: `/supermercado/product/sku/${product.sku}`,
        price: product.price.BasePriceReference,
        best_price: product.price.BasePriceSales
      }
      return scraped
    } catch (error) {
      console.log('Error al obtener los datos principales')
      return undefined
    }
  }

  getCategory (categories: string[]): string {
    for (const category of categories) {
      if (category.includes('Vinos')) return 'Vinos'
      if (category.includes('Cervezas')) return 'Cervezas'
      if (category.includes('Destilados')) return 'Destilados'
    }
    return ''
  }

  getExtraData (scraped: Scraper, product: Product): Scraper {
    // Images
    try {
      scraped.image = product.images.defaultImage.replace('&scale=size[180x180]', '')
    } catch (error) {
      scraped.image = undefined
      console.log('Error al obtener las imagenes')
    }

    // Quantity
    const quantity = this.getEspecification(product.specifications, 'Unidades por paquete')
    if (quantity !== undefined) {
      scraped.quantity = Number(quantity)
    }
    if (Number.isNaN(scraped.quantity)) {
      if (product.displayName.includes('Pack')) {
        const match = product.displayName.match(/Pack, (\d+)/)
        scraped.quantity = (match !== null) ? Number(match[1]) : undefined
      } else {
        scraped.quantity = 1
      }
    }

    // Alcoholic Grade
    const alcoholicGrade = this.getEspecification(product.specifications, 'Graduación alcohólica')
    if (alcoholicGrade !== undefined) {
      scraped.alcoholic_grade = Number(alcoholicGrade.replaceAll(/[^\d+(?:,\d+)?]/g, '').replaceAll(',', '.'))
    }

    // Content
    const content = this.getEspecification(product.specifications, 'Contenido neto')
    if (content !== undefined) {
      scraped.content = Number(content.split(' ')[0])
    }
    if (Number.isNaN(scraped.content)) {
      const match = product.displayName.match(/(\d+)\s*(ml|cc|L|l|c\/u)|(\d+)(ml|cc|L|l|c\/u)/)
      if (match !== null) {
        const amount = Number(match[1])
        const unit = match[2]
        scraped.content = (unit === 'l' || unit === 'L') ? amount * 1000 : amount
      }
    }

    // Package
    const packaging = this.getEspecification(product.specifications, 'Presentación')
    if (packaging !== undefined) {
      if (packaging === 'Botella' || packaging === 'Botellas') scraped.package = 'Botella'
      if (packaging === 'Lata' || packaging === 'Latas') scraped.package = 'Lata'
    }
    if (scraped.package === undefined) {
      const name = product.displayName
      if (name.includes('Botella') || name.includes('Botellas') || name.includes('Botellin')) scraped.package = 'Botella'
      if (name.includes('Lata') || name.includes('Latas')) scraped.package = 'Lata'
    }

    return scraped
  }

  getEspecification (specifications: Specification[], name: string): string | undefined {
    for (const specification of specifications) {
      if (specification.name === name) return specification.value
    }
    return undefined
  }
}
