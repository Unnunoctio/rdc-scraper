
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
}
