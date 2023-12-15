import { saveProducts } from '../utils/db.js'
import { getDrinksApi } from '../utils/drinksApi.js'
import { JumboSpider } from './JumboSpider.js'
import { SantaSpider } from './SantaSpider.js'

export const runSpiders = async (): Promise<void> => {
  // obtener los drinks api
  const drinksApi = await getDrinksApi()

  // jumbo
  const jumboSpider = new JumboSpider()
  const jumboProducts = await jumboSpider.run()
  await saveProducts(jumboProducts, drinksApi, jumboSpider.info)

  // santa
  const santaSpider = new SantaSpider()
  const santaProducts = await santaSpider.run()
  await saveProducts(santaProducts, drinksApi, santaSpider.info)
}
