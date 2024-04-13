import { CencosudProduct, LiderProduct } from '../spiders/types'

export class UpdaterClass {
  product_sku: any | undefined
  url: string | undefined
  price: number | undefined
  best_price: number | undefined
  average: number | null

  constructor (data: CencosudProduct | LiderProduct, website: string, pageUrl: string) {
    this.average = null

    if (website === 'Jumbo' || website === 'Santa Isabel') this.getCencosudData(data as CencosudProduct, pageUrl)
    if (website === 'Lider') this.getLiderData(data as LiderProduct, pageUrl)
  }

  public isComplete (): boolean {
    if (this.product_sku !== undefined && this.url !== undefined && this.price !== undefined && this.best_price !== undefined && this.price > 0 && this.best_price > 0) {
      return true
    }
    return false
  }

  private getCencosudData (data: CencosudProduct, pageUrl: string): void {
    try {
      this.product_sku = data.productId
      this.url = `${pageUrl}/${data.linkText}/p`
      this.price = data.items[0].sellers[0].commertialOffer.PriceWithoutDiscount
      this.best_price = data.items[0].sellers[0].commertialOffer.Price
    } catch (error) {
      console.error('Error al obtener los datos a actualizar', error)
    }
  }

  private getLiderData (data: LiderProduct, pageUrl: string): void {
    try {
      this.product_sku = data.sku
      this.url = `${pageUrl}/supermercado/product/sku/${data.sku}`
      this.price = data.price.BasePriceReference
      this.best_price = data.price.BasePriceSales
    } catch (error) {
      console.error('Error al obtener los datos a actualizar', error)
    }
  }
}
