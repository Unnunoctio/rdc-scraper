import { CencosudProduct, LiderProduct } from '../spiders/types'

export class Updater {
  productSku: string | undefined
  url: string | undefined
  price: number | undefined
  bestPrice: number | undefined
  average: number | null

  constructor () {
    this.average = null
  }

  public isComplete (): boolean {
    if (this.productSku !== undefined && this.url !== undefined && this.price !== undefined && this.price > 0 && this.bestPrice !== undefined && this.bestPrice > 0) {
      return true
    }
    return false
  }

  public setCencosudData (data: CencosudProduct, pageUrl: string): void {
    try {
      this.productSku = data.productId
      this.url = `${pageUrl}/${data.linkText}/p`
      this.price = data.items[0].sellers[0].commertialOffer.PriceWithoutDiscount
      this.bestPrice = data.items[0].sellers[0].commertialOffer.Price
    } catch (error) {
      console.error('Error al obtener los datos a actualizar')
    }
  }

  public setLiderData (data: LiderProduct, pageUrl: string): void {
    try {
      this.productSku = data.sku
      this.url = `${pageUrl}/supermercado/product/sku/${data.sku}`
      this.price = data.price.BasePriceReference
      this.bestPrice = data.price.BasePriceSales
    } catch (error) {
      console.error('Error al obtener los datos a actualizar', error)
    }
  }
}
