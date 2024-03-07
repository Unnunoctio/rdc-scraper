import { Scraper } from '../types.js'
import { saveProducts } from '../utils/db.js'
import { getDrinksApi } from '../utils/drinksApi.js'
import { JumboSpider } from './JumboSpider.js'
import { LiderSpider } from './LiderSpider.js'
import { SantaSpider } from './SantaSpider.js'
import { JumboUnitarySpider } from './unitary-spiders/JumboUnitarySpider.js'
import { LiderUnitarySpider } from './unitary-spiders/LiderUnitarySpider.js'
import { SantaUnitarySpider } from './unitary-spiders/SantaUnitarySpider.js'

export const testSpider = async (): Promise<void> => {
  const liderSpider = new LiderSpider()
  const products = await liderSpider.run()
  console.log(products.length)
}

export const runSpiders = async (): Promise<Scraper[]> => {
  // obtener los drinks api
  const drinksApi = await getDrinksApi()
  const notFoundProducts: Scraper[] = []

  // jumbo
  console.time('Jumbo Scraping')
  const jumboSpider = new JumboSpider()
  const jumboUnitSpider = new JumboUnitarySpider()

  const [jumboScraped, jumboIncompletes] = await jumboSpider.run()
  const jumboUnitScraped = await jumboUnitSpider.run(jumboIncompletes.map(i => i.product_url))
  const jumboNotFound = await saveProducts([jumboScraped, jumboUnitScraped].flat(), drinksApi, jumboSpider.info)
  console.timeEnd('Jumbo Scraping')
  console.log('----------------------------------------')
  notFoundProducts.push(...jumboNotFound)

  // santa
  console.time('Santa Scraping')
  const santaSpider = new SantaSpider()
  const santaUnitSpider = new SantaUnitarySpider()

  const [santaScraped, santaIncompletes] = await santaSpider.run()
  const santaUnitScraped = await santaUnitSpider.run(santaIncompletes.map(i => i.product_url))
  const santaNotFound = await saveProducts([santaScraped, santaUnitScraped].flat(), drinksApi, santaSpider.info)
  console.timeEnd('Santa Scraping')
  console.log('----------------------------------------')
  notFoundProducts.push(...santaNotFound)

  // lider
  console.time('Lider Scraping')
  const liderSpider = new LiderSpider()
  const liderUnitSpider = new LiderUnitarySpider()

  const [liderScraped, liderIncompletes] = await liderSpider.run()
  const liderUnitScraped = await liderUnitSpider.run(liderIncompletes.map(i => i.product_url))
  const liderNotFound = await saveProducts([liderScraped, liderUnitScraped].flat(), drinksApi, liderSpider.info)
  console.timeEnd('Lider Scraping')
  // console.log('----------------------------------------')
  notFoundProducts.push(...liderNotFound)

  return notFoundProducts
}
