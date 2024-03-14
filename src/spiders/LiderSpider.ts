import axios from 'axios'
import { Info, Scraper, UpdateWebsite } from '../types'
import { LiderBody, LiderProduct, LiderResponse, LiderSpecification, Spider } from './types'
import { BATCH_SIZE, SLEEP_TIME } from '../config.js'

export class LiderSpider implements Spider {
  info: Info = {
    name: 'Lider',
    logo: 'https://www.walmartchile.cl/wp-content/themes/walmartchile/img/favicon-32x32.png'
  }

  headers: { [key: string]: string } = {
    'X-Channel': 'SOD',
    Tenant: 'supermercado'
  }

  start_urls: string[] = [
    'https://apps.lider.cl/supermercado/bff/category'
  ]

  start_bodies: LiderBody[] = [
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

  block_urls: string[] = []

  page_url = 'https://www.lider.cl'
  product_url = 'https://apps.lider.cl/supermercado/bff/products'

  async run (paths: string[]): Promise<[UpdateWebsite[], Scraper[]]> {
    console.log('Running Lider Spider')

    // Obtener todas las paginas por cada body
    const bodies = (await Promise.all(this.start_bodies.map(async (body) => {
      return await this.getBodies(body)
    }))).flat()

    // Obtener todos los productos de todos los body
    const products = (await Promise.all(bodies.map(async (body) => {
      const { data } = await axios.post<LiderResponse>(`${this.start_urls[0]}`, body, { headers: this.headers })
      return data.products
    }))).flat()

    const updatingProducts: Array<UpdateWebsite | undefined> = []
    const completeProducts: Scraper[] = []
    const incompletesUrls: string[] = []

    // Recorren los productos y se separan en los distintos arrays
    products.forEach((product) => {
      const path = `${this.page_url}/supermercado/product/sku/${product.sku}`
      // Saltar los productos bloqueados
      if (this.block_urls.includes(path) || !product.available) return

      // Productos que solo necesitan actualizar precio y average
      if (paths.includes(path)) {
        updatingProducts.push(this.getUpdateData(product))
        return
      }

      // Obtener toda la data del producto para saber si esta completo o incompleto
      let scraped = this.getMainData(product)
      if (scraped !== undefined) {
        scraped = this.getExtraData(scraped, product)
        const isIncomplete = (scraped.title === undefined || scraped.brand === undefined || scraped.alcoholic_grade === undefined || scraped.content === undefined || scraped.quantity === undefined || scraped.package === undefined)

        // Separamos entre completo o incompleto
        if (isIncomplete) incompletesUrls.push(`${this.product_url}/${product.sku}`)
        else completeProducts.push(scraped)
      }
    })

    // Completa los productos incompletos y los agrega al array de productos completos
    completeProducts.push(...(await this.toCompleteData(incompletesUrls)))

    // Filtran todos los productos completos con el fin de que no se generen errores de datos faltantes
    const filteredProducts = completeProducts.filter((p) => {
      return p?.title !== undefined &&
             p.brand !== undefined &&
             p.category !== undefined &&
             p.url !== undefined &&
             p.price !== undefined && p.price !== 0 &&
             p.best_price !== undefined && p.best_price !== 0 &&
             p.image !== undefined &&
             p.alcoholic_grade !== undefined &&
             p.content !== undefined &&
             p.quantity !== undefined &&
             p.package !== undefined
    })

    // Obtener los averages de ambos arrays
    const updatingProductsAverage = updatingProducts.filter(u => u !== undefined && u.best_price !== 0 && u.price !== 0).map(u => { return { ...u, average: null } }) as UpdateWebsite[]
    const completeProductsAverage = filteredProducts.map(p => { return { ...p, average: null } }) as Scraper[]

    return [updatingProductsAverage, completeProductsAverage]
  }

  async getBodies (body: LiderBody): Promise<LiderBody[]> {
    const { data } = await axios.post<LiderResponse>(`${this.start_urls[0]}`, body, { headers: this.headers })

    const bodies: LiderBody[] = []
    for (let i = 1; i <= data.nbPages; i++) {
      bodies.push({ ...body, page: i })
    }
    return bodies
  }

  getUpdateData (product: LiderProduct): UpdateWebsite | undefined {
    try {
      return {
        product_sku: product.sku,
        url: `${this.page_url}/supermercado/product/sku/${product.sku}`,
        price: product.price.BasePriceReference,
        best_price: product.price.BasePriceSales
      }
    } catch (error) {
      console.log('Error al obtener los datos para actualizar')
      return undefined
    }
  }

  getMainData (product: LiderProduct): Scraper | undefined {
    try {
      const scraped: Scraper = {
        website: this.info.name,
        product_sku: product.sku,
        title: product.displayName,
        brand: product.brand,
        category: this.getCategory(product.categorias),
        url: `${this.page_url}/supermercado/product/sku/${product.sku}`,
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

  getExtraData (scraped: Scraper, product: LiderProduct): Scraper {
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

  getEspecification (specifications: LiderSpecification[], name: string): string | undefined {
    for (const specification of specifications) {
      if (specification.name === name) return specification.value
    }
    return undefined
  }

  async toCompleteData (incompleteUrls: string[]): Promise<Scraper[]> {
    // Separar urls en batchs
    const splitUrls = this.getSplitArray(incompleteUrls, BATCH_SIZE)

    const products: LiderProduct[] = []
    for (const urls of splitUrls) {
      // espera x segundos
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME))

      // obtiene los productos de cada url
      const fetchProducts = await Promise.all(urls.map(async (url) => {
        try {
          const { data } = await axios.get<LiderProduct[]>(`${url}`, { headers: this.headers })
          return data[0]
        } catch (error) {
          console.log(`Error al hacer fetch: ${url}`)
        }
        return undefined
      }))
      products.push(...fetchProducts.filter(p => p !== undefined) as LiderProduct[])
    }

    // Obtener productos scrapeados
    const scrapedProducts = await Promise.all(products.map(async (product) => {
      let scraped = this.getMainData(product)
      if (scraped === undefined) return undefined
      scraped = this.getExtraData(scraped, product)
      return scraped
    }))

    return scrapedProducts.filter(s => s !== undefined) as Scraper[]
  }

  getSplitArray (arr: string[], size: number): string[][] {
    const result: string[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }
}
