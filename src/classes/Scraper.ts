import { CencosudProduct } from '../spiders/types'

export class Scraper {
  website: string
  productSku: string | undefined
  title: string | undefined
  brand: string | undefined
  category: string | undefined
  url: string | undefined
  price: number | undefined
  bestPrice: number | undefined
  image: string | undefined
  average: number | null
  alcoholicGrade: number | undefined
  content: number | undefined
  quantity: number | undefined
  package: string | undefined

  constructor (website: string) {
    this.website = website
    this.average = null
  }

  public isIncomplete (): boolean {
    if (this.productSku === undefined || this.title === undefined || this.brand === undefined || this.category === undefined || this.url === undefined || this.price === undefined || this.price === 0 || this.bestPrice === undefined || this.bestPrice === 0 || this.image === undefined || this.alcoholicGrade === undefined || this.content === undefined || this.quantity === undefined || this.package === undefined) {
      return true
    }
    return false
  }

  public setCencosudData (data: CencosudProduct, pageUrl: string): void {
    // Main data
    try {
      this.productSku = data.productId
      this.title = data.productName
      this.brand = data.brand
      this.category = data.categories[0].split('/')[2]
      this.url = `${pageUrl}/${data.linkText}/p`
      this.price = data.items[0].sellers[0].commertialOffer.PriceWithoutDiscount
      this.bestPrice = data.items[0].sellers[0].commertialOffer.Price
    } catch (error) {
      console.error('Error al obtener los datos principales', data.productName)
    }

    // Image
    try {
      const link = data.items[0].images[0].imageUrl
      const linkSplit = link.split('/')
      const linkParsed = linkSplit.slice(0, -1).join('/')
      this.image = linkParsed
    } catch (error) {
      console.error('Error al obtener la imagen', data.productName)
    }

    // Quantity
    if (data.productName.includes('Pack')) {
      if (data.Cantidad !== undefined) {
        const match = data.Cantidad[0].match(/^(\d+)/)
        this.quantity = (match != null) ? Number(match[0]) : undefined
      }
      if (this.quantity === undefined) {
        const match = data.productName.match(/(\d+)\s*un\./i)
        this.quantity = (match != null) ? Number(match[1]) : undefined
      }
    } else if (data.productName.includes('Bipack')) {
      this.quantity = 2
    } else {
      this.quantity = 1
    }

    // Alcoholic Grade
    if (data['Graduación Alcohólica'] !== undefined) {
      const match = data['Graduación Alcohólica'][0].match(/(\d+(?:\.\d+)?)°/)
      this.alcoholicGrade = (match != null) ? Number(match[1]) : undefined
    }
    if (data.productName.includes('°') && this.alcoholicGrade === undefined) {
      const match = data.productName.match(/(\d+(?:\.\d+)?)°/)
      this.alcoholicGrade = (match != null) ? Number(match[1]) : undefined
    }

    // Content
    if (this.content === undefined) {
      const match = data.productName.match(/(\d+(?:\.\d+)?) (cc|L)/i)
      if (match !== null) {
        const amount = Number(match[1])
        const unit = match[2].toLowerCase()
        this.content = (unit === 'l') ? amount * 1000 : amount
      }
    }

    // Package
    if (this.category === 'Destilados') this.package = 'Botella'

    if (data.Envase !== undefined) {
      if (data.Envase[0].includes('Botella')) {
        this.package = 'Botella'
      } else if (data.Envase[0].includes('Lata')) {
        this.package = 'Lata'
      } else if (data.Envase[0].includes('Barril')) {
        this.package = 'Barril'
      } else if (data.Envase[0].includes('Tetrapack')) {
        this.package = 'Tetrapack'
      } else if (data.Envase[0].includes('Caja') && this.category === 'Destilados') {
        this.package = 'Botella'
      } else if (data.Envase[0].includes('Caja') && this.category === 'Vinos') {
        this.package = 'Tetrapack'
      }
    }
    if (this.package === undefined) {
      const titleLower = data.productName.toLowerCase()
      if (titleLower.includes('botella')) {
        this.package = 'Botella'
      } else if (titleLower.includes('lata')) {
        this.package = 'Lata'
      } else if (titleLower.includes('barril')) {
        this.package = 'Barril'
      } else if (titleLower.includes('tetrapack') || titleLower.includes('caja')) {
        this.package = 'Tetrapack'
      }
    }
  }
}
