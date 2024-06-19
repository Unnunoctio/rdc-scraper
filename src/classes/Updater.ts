import type { CencosudProduct } from '../spiders/types'

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
    return this.productSku !== undefined && this.url !== undefined && this.price !== undefined && this.price > 0 && this.bestPrice !== undefined && this.bestPrice > 0 && this.average !== null
  }

  public setCencosudData (data: CencosudProduct, pageUrl: string): void {
    try {
      this.productSku = data.productId
      this.url = `${pageUrl}/${data.linkText}/p`
      this.price = data.items[0].sellers[0].commertialOffer.PriceWithoutDiscount
      this.bestPrice = data.items[0].sellers[0].commertialOffer.Price
    } catch (error) {
      console.error('Error when obtaining the data to update')
    }
  }
}
