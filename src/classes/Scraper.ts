
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
    return this.productSku === undefined || this.title === undefined || this.brand === undefined || this.category === undefined || this.url === undefined || this.price === undefined || this.price === 0 || this.bestPrice === undefined || this.bestPrice === 0 || this.image === undefined || this.alcoholicGrade === undefined || this.content === undefined || this.quantity === undefined || this.package === undefined
  }
}
