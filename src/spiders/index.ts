import { Scraper } from '../types.js'
import { saveProducts } from '../utils/db.js'
import { getDrinksApi } from '../utils/drinksApi.js'
import { JumboSpider } from './JumboSpider.js'
import { LiderSpider } from './LiderSpider.js'
import { SantaSpider } from './SantaSpider.js'

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
  const jumboSpider = new JumboSpider()
  const jumboProducts = await jumboSpider.run()
  const jumboNotFound = await saveProducts(jumboProducts, drinksApi, jumboSpider.info)
  notFoundProducts.push(...jumboNotFound)

  // santa
  const santaSpider = new SantaSpider()
  const santaProducts = await santaSpider.run()
  const santaNotFound = await saveProducts(santaProducts, drinksApi, santaSpider.info)
  notFoundProducts.push(...santaNotFound)

  // lider
  const liderSpider = new LiderSpider()
  const liderProducts = await liderSpider.run()
  const liderNotFound = await saveProducts(liderProducts, drinksApi, liderSpider.info)
  notFoundProducts.push(...liderNotFound)

  return notFoundProducts
}
