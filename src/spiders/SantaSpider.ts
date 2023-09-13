import axios from 'axios'
import { HeaderType, ProductScraper, Spider, UpdateWebsite, UrlType, Website } from '../types'
import { addProduct, deleteWithoutStock, isProductExist, updateWebsite } from '../utils/utilsDB.js'
import { isBrandExist } from '../utils/utilsAPI.js'

interface SantaResponse {
  redirect: null
  products: SantaProduct[]
  recordsFiltered: number
  operator: string
}

interface SantaProduct {
  productId: string
  productName: string
  brand: string
  categories: string[]
  linkText: string
  items: Item[]
  'Graduación Alcohólica'?: string[]
  Grado?: string[]
  Envase?: string[]
  Cantidad?: string[]
  Contenido?: string[]
}

interface Item {
  images: Image[]
  sellers: Seller[]
}

interface Image {
  imageUrl: string
  imageTag: string
}

interface Seller {
  commertialOffer: {
    Price: number
    ListPrice: number
    PriceWithoutDiscount: number
    AvailableQuantity: number
  }
}

interface Average {
  average: number
  totalCount: number
  id: number
}

export class SantaSpider implements Spider {
  websiteName: string = 'Santa Isabel'
  websiteUrl: string = 'https://santaisabel.cl'
  websiteLogo: string = 'https://assets.santaisabel.cl/favicon/favicon-196x196.png'
  headers: HeaderType = {
    apiKey: 'WlVnnB7c1BblmgUPOfg',
    'x-account': 'pedrofontova',
    'x-consumer': 'santaisabel'
  }

  startUrls: UrlType[] = [
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/cervezas',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/destilados',
    'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/pedrofontova/products/vinos-cervezas-y-licores/vinos'
  ]

  productUrl: UrlType = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/pedrofontova/product'
  watcher: number = new Date().getTime()
  averageUrl: UrlType = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings'

  async run (): Promise<ProductScraper[]> {
    console.time('Santa Spider')
    console.log('Running Santa Spider')

    // ? Obtener todas las paginas por cada url
    const pages = await Promise.all(this.startUrls.map(async (url: UrlType) => {
      const totalPages = await this.getTotalPages(url)
      const pages = this.generatePages(totalPages, url)
      return pages
    }))

    // ? Obtener todos los productos por cada pagina
    const allPages = pages.flat()
    const products = await Promise.all(allPages.map(async (url: UrlType) => {
      const { data }: { data: SantaResponse } = await axios.get(`${url}&sc=1`, { headers: this.headers })
      return data.products
    }))

    // ?: Recorre los productos, actualiza o agrega en la DB y retorna los productos no encontrados
    const allProducts = products.flat()
    const productsNotFound = await Promise.all(allProducts.map(async (product: SantaProduct) => {
      const url = `${this.websiteUrl}/${product.linkText}/p`

      if (await isProductExist(url) && product.items[0].sellers[0].commertialOffer.AvailableQuantity > 0) {
        const { data }: { data: Average[] } = await axios.get(`${this.averageUrl}?ids=${product.productId}`, { headers: this.headers })
        const update: UpdateWebsite = {
          url,
          price: product.items[0].sellers[0].commertialOffer.PriceWithoutDiscount,
          best_price: product.items[0].sellers[0].commertialOffer.Price,
          average: data[0].average,
          watch: this.watcher
        }

        await updateWebsite(update)
        return undefined
      } else {
        let productData = this.getMainProductData(product)

        if (await isBrandExist(productData.brand) && product.items[0].sellers[0].commertialOffer.AvailableQuantity > 0) {
          productData = this.getExtraProductData(productData, product)
          // TODO: Test urls
          if (url === '') {
            console.log(productData)
            console.log(product)
          }
          if (productData.quantity === undefined || productData.alcoholicGrade === undefined || productData.content === undefined || productData.package === undefined) return productData

          const { data }: { data: Average[] } = await axios.get(`${this.averageUrl}?ids=${product.productId}`, { headers: this.headers })
          const website: Website = {
            name: this.websiteName,
            logo: this.websiteLogo,
            url,
            price: productData.price as number,
            best_price: productData.bestPrice as number,
            average: data[0].average,
            watch: this.watcher
          }

          const isProductAdd = await addProduct(website, productData)
          if (isProductAdd) {
            return undefined
          } else {
            return productData
          }
        } else {
          return productData
        }
      }
    }))

    // ?: Elimina los websites de Santa de los productos donde el watcher es distinto al generado
    await deleteWithoutStock(this.websiteName, this.watcher)

    console.log('Santa Spider finished')
    console.timeEnd('Santa Spider')
    return productsNotFound.filter(product => product !== undefined) as ProductScraper[]
  }

  async getTotalPages (url: UrlType): Promise<number> {
    const { data }: { data: SantaResponse } = await axios.get(`${url}?sc=1`, { headers: this.headers })
    return Math.ceil(data.recordsFiltered / 40)
  }

  generatePages (totalPages: number, baseUrl: UrlType): UrlType[] {
    const pages: UrlType[] = []
    for (let i = 1; i <= totalPages; i++) {
      pages.push(`${baseUrl}?page=${i}`)
    }
    return pages
  }

  getMainProductData (product: SantaProduct): ProductScraper {
    const productData: ProductScraper = {
      websiteName: this.websiteName,
      title: product.productName,
      brand: product.brand,
      category: product.categories[0].split('/')[2],
      subCategory: product.categories[0].split('/')[3],
      url: `${this.websiteUrl}/${product.linkText}/p`
    }
    return productData
  }

  getExtraProductData (productData: ProductScraper, product: SantaProduct): ProductScraper {
    const extraData: ProductScraper = {
      ...productData,
      imageUrl: product.items[0].images[0].imageUrl,
      price: product.items[0].sellers[0].commertialOffer.PriceWithoutDiscount,
      bestPrice: product.items[0].sellers[0].commertialOffer.Price
    }

    //* Quantity
    if (product.productName.includes('Pack')) {
      if (product.Cantidad !== undefined) {
        const match = product.Cantidad[0].match(/^(\d+)/)
        extraData.quantity = (match != null) ? Number(match[0]) : undefined
      } else {
        const match = product.productName.match(/(\d+)\s*un\./i)
        extraData.quantity = (match != null) ? Number(match[1]) : undefined
      }
    } else if (product.productName.includes('Bipack')) {
      extraData.quantity = 2
    } else {
      extraData.quantity = 1
    }

    //* Extra verfify quatity
    if (extraData.quantity !== undefined && extraData.quantity > 12 && productData.category === 'Destilados') {
      extraData.quantity = 1
    }

    //* Alcoholic Grade
    if (product['Graduación Alcohólica'] !== undefined) {
      const match = product['Graduación Alcohólica'][0].match(/(\d+(?:\.\d+)?)°/)
      extraData.alcoholicGrade = (match != null) ? Number(match[1]) : undefined
    } else if (product.Grado !== undefined) {
      const match = product.Grado[0].match(/(\d+(?:\.\d+)?)°/)
      extraData.alcoholicGrade = (match != null) ? Number(match[1]) : undefined
    } else if (product.productName.includes('°')) {
      const match = product.productName.match(/(\d+(?:\.\d+)?)°/)
      extraData.alcoholicGrade = (match != null) ? Number(match[1]) : undefined
    }

    //* Content
    if (product.Contenido !== undefined) {
      const match = product.Contenido[0].match(/(\d+(\.\d+)?)\s*(cc|ml|L|l|litro|litros?)/i)
      if (match !== null) {
        const amount = Number(match[1])
        const unit = match[3].toLowerCase()
        extraData.content = (unit === 'l' || unit === 'litro' || unit === 'litros') ? amount * 1000 : amount
      } else {
        extraData.content = undefined
      }
    } else {
      const match = product.productName.match(/(\d+(?:\.\d+)?) (cc|L)/i)
      if (match !== null) {
        const amount = Number(match[1])
        const unit = match[2].toLowerCase()
        extraData.content = (unit === 'l') ? amount * 1000 : amount
      } else {
        extraData.content = undefined
      }
    }

    //* Package
    //* Package Default Destilados
    if (productData.category === 'Destilados') extraData.package = 'Botella'

    if (product.Envase !== undefined) {
      if (product.Envase[0].includes('Botella')) {
        extraData.package = 'Botella'
      } else if (product.Envase[0].includes('Lata')) {
        extraData.package = 'Lata'
      } else if (product.Envase[0].includes('Barril')) {
        extraData.package = 'Barril'
      } else if (product.Envase[0].includes('Tetrapack')) {
        extraData.package = 'Tetrapack'
      } else if (product.Envase[0].includes('Caja') && productData.category === 'Destilados') {
        extraData.package = 'Botella'
      } else if (product.Envase[0].includes('Caja') && productData.category === 'Vinos') {
        extraData.package = 'Tetrapack'
      } else {
        extraData.package = undefined
      }
    } else {
      const titleLower = product.productName.toLowerCase()
      if (titleLower.includes('botella')) {
        extraData.package = 'Botella'
      } else if (titleLower.includes('lata')) {
        extraData.package = 'Lata'
      } else if (titleLower.includes('barril')) {
        extraData.package = 'Barril'
      } else if (titleLower.includes('tetrapack') || titleLower.includes('caja')) {
        extraData.package = 'Tetrapack'
      }
    }

    return extraData
  }
}
