import { Scraper } from '../types'
import { deleteManyDrinks } from '../utils/db-delete.js'
import { getAllPathWebsites } from '../utils/db-get.js'
import { saveManyDrinks, saveManyProducts } from '../utils/db-save.js'
import { updateManyWebsites, updateManyWebsitesWithoutStock } from '../utils/db-update.js'
import { getDrinksApi } from '../utils/drinks-api.js'
import { JumboSpider } from './JumboSpider.js'
import { SantaSpider } from './SantaSpider.js'

export const runSpiders = async (): Promise<Scraper[]> => {
  // obtener los drinks api, todos los paths y guardar los drinks into de db
  const drinksApi = await getDrinksApi()
  const allPaths = await getAllPathWebsites()
  const drinks = await saveManyDrinks(drinksApi)

  // inicializa el watcher y el array de productos no encontrados
  const watcher = new Date().getTime()
  const notFoundProducts: Scraper[] = []

  // jumbo
  console.time('Jumbo Scraping')
  const jumboSpider = new JumboSpider()
  const [jumboUpdating, jumboScraped] = await jumboSpider.run(allPaths)
  await updateManyWebsites(jumboUpdating, watcher)
  const jumboNotFound = await saveManyProducts(jumboScraped, drinks, jumboSpider.info, watcher)
  console.timeEnd('Jumbo Scraping')
  console.log('----------------------------------------')
  notFoundProducts.push(...jumboNotFound)

  // santa
  console.time('Santa Scraping')
  const santaSpider = new SantaSpider()
  const [santaUpdating, santaScraped] = await santaSpider.run(allPaths)
  await updateManyWebsites(santaUpdating, watcher)
  const santaNotFound = await saveManyProducts(santaScraped, drinks, santaSpider.info, watcher)
  console.timeEnd('Santa Scraping')
  console.log('----------------------------------------')
  notFoundProducts.push(...santaNotFound)

  // actualizan todos los productos sin stock y se eliminan los drinks que no esten en ningun producto
  await updateManyWebsitesWithoutStock(watcher)
  await deleteManyDrinks()

  return notFoundProducts
}
